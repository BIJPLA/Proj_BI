'use strict';
/**
 * Alfred — Vercel Serverless Function
 * Recebe pergunta em PT-BR → gera SQL via Gemini → consulta MySQL → responde em PT-BR
 * Credenciais ofuscadas via variáveis de ambiente Vercel (base64)
 */

const mysql = require('mysql2/promise');

// ─── Decodificador de credenciais ────────────────────────────────────────────
// Todas as credenciais ficam em variáveis de ambiente Vercel (nunca no código)
// Os valores são armazenados em base64 para ofuscação adicional
function _r(k) {
  const raw = process.env[k];
  if (!raw) return '';
  try { return Buffer.from(raw, 'base64').toString('utf8'); } catch { return raw; }
}

// Nomes internos propositalmente neutros
const _cfg = {
  get h() { return _r('_LH'); },   // host
  get p() { return parseInt(_r('_LP') || '3307'); }, // port
  get u() { return _r('_LU'); },   // user
  get w() { return _r('_LW'); },   // password
  get d() { return _r('_LD'); },   // database
};
const _gk = () => _r('_LG');       // Gemini API key

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function _callGemini(prompt) {
  const key = _gk();
  if (!key) throw new Error('Configuração de integração incompleta. Contate o administrador.');

  const endpoint = [
    'https://generativelanguage.googleapis.com/v1beta/models/',
    'gemini-1.5-flash:generateContent?key=',
    key
  ].join('');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Serviço de IA indisponível (${res.status}). ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

// ─── Schema do banco ─────────────────────────────────────────────────────────
async function _getSchema(conn) {
  try {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME, TABLE_ROWS
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_ROWS DESC LIMIT 25`,
      [_cfg.d]
    );

    const schema = [];
    for (const { TABLE_NAME } of tables.slice(0, 15)) {
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION LIMIT 30`,
        [_cfg.d, TABLE_NAME]
      );
      const colList = cols.map(c => {
        const pk = c.COLUMN_KEY === 'PRI' ? ' [PK]' : '';
        return `${c.COLUMN_NAME} (${c.DATA_TYPE}${pk})`;
      }).join(', ');
      schema.push(`${TABLE_NAME}: ${colList}`);
    }
    return schema.join('\n');
  } catch (e) {
    return '(schema indisponível)';
  }
}

// ─── Gerar SQL via Gemini ────────────────────────────────────────────────────
async function _gerarSQL(pergunta, schema) {
  const prompt = `Você é especialista em MySQL. Gere APENAS o SQL puro — sem markdown, sem explicação, sem blocos de código.

Banco de dados: ${_cfg.d}
Tabelas disponíveis:
${schema}

Pergunta do usuário (em português): "${pergunta}"

Regras obrigatórias:
1. Retorne SOMENTE o SQL, nada mais
2. Use apenas SELECT (proibido INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
3. Adicione LIMIT 200 em toda consulta principal
4. Use alias em português quando possível para facilitar a leitura
5. Se a pergunta for ambígua, consulte as colunas mais relevantes`;

  const sqlRaw = await _callGemini(prompt);

  // Limpar possíveis marcadores de markdown
  const sql = sqlRaw
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  // Validação de segurança: só SELECT
  const upper = sql.toUpperCase();
  const bloqueadas = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];
  for (const palavra of bloqueadas) {
    if (upper.includes(palavra)) {
      throw new Error(`Operação não permitida detectada no SQL gerado: ${palavra}`);
    }
  }

  if (!upper.trim().startsWith('SELECT') && !upper.trim().startsWith('WITH')) {
    throw new Error('Apenas consultas de leitura são permitidas.');
  }

  return sql;
}

// ─── Formatar resposta em PT-BR ───────────────────────────────────────────────
async function _formatarResposta(pergunta, sql, rows) {
  const amostra = rows.slice(0, 50);
  const prompt = `Você é Alfred, assistente inteligente de dados da LandApp.
Responda SEMPRE em português brasileiro, de forma clara, objetiva e amigável.

Pergunta do usuário: "${pergunta}"

SQL executada: ${sql}

Resultado do banco (${rows.length} registro(s) no total, mostrando até 50):
${JSON.stringify(amostra, null, 2)}

Instruções:
- Se houver poucos dados: liste-os claramente
- Se houver muitos dados: resuma com métricas (total, média, destaque)
- Seja específico com números e nomes
- Use linguagem natural, não técnica
- Não mencione SQL ou banco de dados na resposta
- Responda como se fosse um analista explicando os dados para um colega`;

  return await _callGemini(prompt);
}

// ─── Handler principal ───────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS para uso no Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const { question, portalContext } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ ok: false, error: 'Pergunta não pode estar vazia.' });
  }

  let conn;
  try {
    // Conectar ao banco
    conn = await mysql.createConnection({
      host: _cfg.h,
      port: _cfg.p,
      user: _cfg.u,
      password: _cfg.w,
      database: _cfg.d,
      connectTimeout: 12000,
      ssl: { rejectUnauthorized: false }
    });

    // Buscar schema
    const schema = await _getSchema(conn);

    // Gerar SQL
    const sql = await _gerarSQL(question.trim(), schema);

    // Executar consulta
    const [rows] = await conn.query(sql);

    // Formatar resposta em PT-BR
    const answer = await _formatarResposta(question.trim(), sql, rows);

    return res.status(200).json({
      ok: true,
      answer,
      rowCount: rows.length,
      sql  // incluído para debug — pode ser removido em produção
    });

  } catch (err) {
    console.error('[Alfred] Erro:', err.message);

    // Mensagens de erro amigáveis em PT-BR
    let userMsg = 'Não consegui processar sua pergunta. Tente reformular.';
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      userMsg = 'Não foi possível conectar ao banco de dados. Verifique as configurações.';
    } else if (err.message.includes('ER_ACCESS_DENIED')) {
      userMsg = 'Acesso ao banco negado. Verifique as credenciais.';
    } else if (err.message.includes('ER_NO_SUCH_TABLE')) {
      userMsg = 'Tabela não encontrada. Reformule sua pergunta.';
    } else if (err.message.includes('Operação não permitida')) {
      userMsg = 'Só consigo fazer consultas de leitura. Reformule sua pergunta.';
    } else if (err.message.includes('Serviço de IA')) {
      userMsg = err.message;
    }

    return res.status(500).json({ ok: false, error: userMsg });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
};
