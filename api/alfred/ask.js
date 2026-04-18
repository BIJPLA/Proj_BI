'use strict';
/**
 * Alfred — Vercel Serverless Function
 * Recebe pergunta em PT-BR → gera SQL via Groq (LLaMA) → consulta MySQL → responde em PT-BR
 * Credenciais ofuscadas via variáveis de ambiente Vercel (base64)
 */

const mysql = require('mysql2/promise');

// ─── Decodificador de credenciais ────────────────────────────────────────────
function _r(k) {
  const raw = process.env[k];
  if (!raw) return '';
  try { return Buffer.from(raw, 'base64').toString('utf8'); } catch { return raw; }
}

const _cfg = {
  get h() { return _r('_LH'); },
  get p() { return parseInt(_r('_LP') || '3307'); },
  get u() { return _r('_LU'); },
  get w() { return _r('_LW'); },
  get d() { return _r('_LD'); },
};
const _gk = () => _r('_LG');

// ─── Groq (LLaMA 3) ──────────────────────────────────────────────────────────
async function _callAI(systemPrompt, userPrompt) {
  const key = _gk();
  if (!key) throw new Error('Configuração de integração incompleta. Contate o administrador.');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      temperature: 0.1,
      max_tokens: 2048
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Serviço de IA indisponível (${res.status}). ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ─── Schema do banco ─────────────────────────────────────────────────────────
async function _getSchema(conn) {
  try {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME LIMIT 25`,
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

// ─── Gerar SQL ────────────────────────────────────────────────────────────────
async function _gerarSQL(pergunta, schema) {
  const system = `Você é especialista em MySQL. Retorne APENAS o SQL puro — sem markdown, sem explicação, sem blocos de código.

Banco: ${_cfg.d}
Tabelas:
${schema}

Regras:
1. SOMENTE SELECT (proibido INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
2. Sempre LIMIT 200
3. Use alias em português quando possível`;

  const sqlRaw = await _callAI(system, `Pergunta: "${pergunta}"`);

  const sql = sqlRaw
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  const upper = sql.toUpperCase();
  const bloqueadas = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];
  for (const p of bloqueadas) {
    if (upper.includes(p)) throw new Error(`Operação não permitida: ${p}`);
  }
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Apenas consultas de leitura são permitidas.');
  }

  return sql;
}

// ─── Formatar resposta em PT-BR ───────────────────────────────────────────────
async function _formatarResposta(pergunta, rows) {
  const system = `Você é Alfred, assistente de dados da LandApp.
Responda SEMPRE em português brasileiro, de forma clara e objetiva.
Nunca mencione SQL, banco de dados ou tecnologia na resposta.
Seja como um analista explicando dados para um colega.`;

  const user = `Pergunta: "${pergunta}"
Dados retornados (${rows.length} registro(s)):
${JSON.stringify(rows.slice(0, 50), null, 2)}`;

  return await _callAI(system, user);
}

// ─── Handler principal ───────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  const { question } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ ok: false, error: 'Pergunta não pode estar vazia.' });

  let conn;
  try {
    conn = await mysql.createConnection({
      host: _cfg.h,
      port: _cfg.p,
      user: _cfg.u,
      password: _cfg.w,
      database: _cfg.d,
      connectTimeout: 12000,
      ssl: { rejectUnauthorized: false }
    });

    const schema  = await _getSchema(conn);
    const sql     = await _gerarSQL(question.trim(), schema);
    const [rows]  = await conn.query(sql);
    const answer  = await _formatarResposta(question.trim(), rows);

    return res.status(200).json({ ok: true, answer, rowCount: rows.length, sql });

  } catch (err) {
    console.error('[Alfred] Erro:', err.message);

    let userMsg = 'Não consegui processar sua pergunta. Tente reformular.';
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      userMsg = 'Não foi possível conectar ao banco de dados.';
    } else if (err.message.includes('ER_ACCESS_DENIED')) {
      userMsg = 'Acesso ao banco negado. Verifique as credenciais.';
    } else if (err.message.includes('ER_NO_SUCH_TABLE')) {
      userMsg = 'Tabela não encontrada. Reformule sua pergunta.';
    } else if (err.message.includes('Serviço de IA')) {
      userMsg = err.message;
    }

    return res.status(500).json({ ok: false, error: userMsg });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
};
