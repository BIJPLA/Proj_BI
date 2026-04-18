'use strict';
/**
 * Alfred — Vercel Serverless Function
 * Groq (LLaMA 3.3) + MySQL landapp_production
 * Treinado com o contexto real do banco LandApp
 */

const mysql = require('mysql2/promise');

// ─── Credenciais (base64 via env Vercel) ─────────────────────────────────────
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

// ─── Conhecimento do banco LandApp ────────────────────────────────────────────
// Extraído das consultas reais usadas no Power BI (Terra, Fretes, Motoristas, Veículos)
const LAND_CONTEXT = `
=== CONTEXTO DO BANCO LANDAPP (landapp_production) ===

## TABELAS PRINCIPAIS E SEUS SIGNIFICADOS

### trips — Viagens/Fretes realizados
Campos principais:
- id, hash_id → identificadores únicos da viagem
- status → 'FINALIZED' = concluída | 'CANCELED' = cancelada | 'IN_PROGRESS' = em andamento
- deleted_at → SEMPRE filtrar: deleted_at IS NULL
- driver_id → FK para drivers
- truck_id → FK para trucks
- job_route_id → FK para jobs_routes
- trip_dry_cargo_id → FK para trips_dry_cargo (dados de carga seca)
- begin_at, finalized_at, scheduled_date, end_date → datas da viagem
- distance → distância percorrida (km)
- driver_price → valor pago ao caminhoneiro
- customer_price → valor cobrado do cliente
- volume → volume transportado
- observation → observações

### trips_dry_cargo — Detalhes financeiros da viagem (carga seca)
Campos principais:
- id (FK de trips.trip_dry_cargo_id)
- deleted_at → SEMPRE filtrar: deleted_at IS NULL
- driver_price, customer_price → preço base caminhoneiro/cliente
- helper_driver_price, helper_customer_price → ajudante
- add_km_driver_price, add_km_customer_price → km adicional
- add_hr_driver_price, add_hr_customer_price → hora adicional
- add_point_driver_price, add_point_customer_price → ponto adicional
- add_km_quantity, add_hr_quantity, add_point_quantity → quantidades extras
- helpers_quantity → quantidade de ajudantes
- time_spent → tempo gasto
- document_path → caminho do documento
TOTAL DO MOTORISTA = driver_price + helper_driver_price + add_km_driver_price + add_hr_driver_price + add_point_driver_price
TOTAL DO CLIENTE   = customer_price + helper_customer_price + add_km_customer_price + add_hr_customer_price + add_point_customer_price

### jobs — Obras/Projetos
Campos principais:
- id, name → identificação da obra
- status → situação da obra
- customer_id → FK para customers
- place_id (FK para places) → local da obra
- deleted_at → SEMPRE filtrar: deleted_at IS NULL
- estimated_distance → distância estimada
- contract_cut_volume → volume de corte contratado
- contract_truck_volume → volume de caminhão contratado
- contract_rubble_volume → volume de entulho contratado
- contract_value → valor do contrato

### jobs_routes — Rotas de uma Obra
Campos principais:
- id, name, hash_id → identificação da rota
- job_id → FK para jobs (qual obra pertence)
- deleted_at → SEMPRE filtrar: deleted_at IS NULL
- status → situação da rota
- action → ação da rota
- source_place_id → FK para places (ORIGEM)
- target_place_id → FK para places (DESTINO)
- material_id → FK para materials
- truck_type → tipo de caminhão exigido
- customer_price → preço por unidade cobrado do cliente
- route_cost_price, route_cost_type → custo e tipo de custo da rota
- volume_type → tipo de medição (volume)
- is_standard_route → se é rota padrão
- distance → distância da rota
- total_volume → volume total da rota
- unit_of_measurement → unidade de medida
- is_standard_route → rota padrão sim/não

### customers — Clientes/Empresas
Campos principais:
- id, name, trade_name → nome e razão social
- deleted_at → SEMPRE filtrar: deleted_at IS NULL

### drivers — Motoristas
Campos principais:
- id → identificador
- user_id → FK para auth_users
- deleted_at → SEMPRE filtrar: deleted_at IS NULL
- cnh_due_date → vencimento da CNH

### auth_users — Usuários do sistema (inclui motoristas)
Campos principais:
- id, name, cpf, email
- deleted_at → SEMPRE filtrar: deleted_at IS NULL

### trucks — Caminhões/Veículos
Campos principais:
- id, license_plate (placa), type (tipo)
- fuel_card, fuel_type, tank_capacity
- deleted_at → SEMPRE filtrar: deleted_at IS NULL

### places — Locais (Origem e Destino)
Campos principais:
- id, name → nome do local
- type → tipo do local
Usado duas vezes nos JOINs:
  - source_place_id → origem (alias R ou P)
  - target_place_id → destino (alias T ou Pl)

### materials — Materiais transportados
Campos principais:
- id, name → nome do material

## REGRAS DE NEGÓCIO CRÍTICAS

1. SEMPRE filtrar deleted_at IS NULL em TODAS as tabelas usadas
2. Viagens finalizadas: trips.status = 'FINALIZED'
3. Para valor total do motorista, somar todos os campos _driver_price de trips_dry_cargo
4. Para valor total do cliente, somar todos os campos _customer_price de trips_dry_cargo
5. Para dados completos de uma viagem, sempre fazer JOIN com jobs_routes, jobs, customers, drivers, trucks, places (origem e destino), materials
6. Motoristas ficam em drivers + auth_users (JOIN: auth_users.id = drivers.user_id)

## JOINS PADRÃO (use como referência)

### Consulta completa de viagens (Terra):
SELECT T.id AS id_trip, J.id AS id_obra, R.id AS id_rota,
       C.name AS Cliente, D.id AS id_driver,
       K.type AS truck_type, K.license_plate AS placa,
       P.name AS origem, Pl.name AS destino,
       M.name AS material,
       DATE(T.begin_at) AS data_inicio, DATE(T.finalized_at) AS data_fim,
       T.driver_price AS preco_caminhoneiro, T.customer_price AS preco_cliente,
       T.volume, T.distance AS distancia,
       R.name AS rota_nome, J.name AS obra_nome
FROM trips T
INNER JOIN jobs_routes R ON R.id = T.job_route_id
INNER JOIN jobs J ON J.id = R.job_id
INNER JOIN customers C ON C.id = J.customer_id
INNER JOIN drivers D ON D.id = T.driver_id
INNER JOIN places P ON P.id = R.source_place_id
INNER JOIN trucks K ON K.id = T.truck_id
INNER JOIN places Pl ON Pl.id = R.target_place_id
INNER JOIN materials M ON M.id = R.material_id
WHERE T.deleted_at IS NULL AND T.status = 'FINALIZED'

### Consulta de fretes com financeiro detalhado (Fretes):
SELECT trips.id, customers.trade_name, jobs.name AS obra,
       jobs_routes.name AS rota, R.name AS origem, T.name AS destino,
       auth_users.name AS motorista, auth_users.cpf,
       trucks.license_plate AS placa, trucks.type AS tipo_caminhao,
       materials.name AS material,
       DATE_FORMAT(trips.scheduled_date, '%d/%m/%Y') AS data_agendamento,
       DATE_FORMAT(trips.begin_at, '%d/%m/%Y %H:%i:%s') AS inicio,
       trips.distance AS distancia,
       tdc.time_spent AS tempo_gasto,
       tdc.helpers_quantity AS ajudantes,
       (tdc.driver_price + tdc.helper_driver_price + tdc.add_km_driver_price + tdc.add_hr_driver_price + tdc.add_point_driver_price) AS total_motorista,
       (tdc.customer_price + tdc.helper_customer_price + tdc.add_km_customer_price + tdc.add_hr_customer_price + tdc.add_point_customer_price) AS total_cliente
FROM trips
INNER JOIN trips_dry_cargo tdc ON tdc.id = trips.trip_dry_cargo_id
INNER JOIN drivers ON drivers.id = trips.driver_id
INNER JOIN auth_users ON auth_users.id = drivers.user_id
INNER JOIN trucks ON trucks.id = trips.truck_id
INNER JOIN jobs_routes ON jobs_routes.id = trips.job_route_id
INNER JOIN jobs ON jobs.id = jobs_routes.job_id
INNER JOIN customers ON customers.id = jobs.customer_id
INNER JOIN materials ON materials.id = jobs_routes.material_id
INNER JOIN places AS R ON R.id = jobs_routes.source_place_id
INNER JOIN places AS T ON T.id = jobs_routes.target_place_id
WHERE trips.deleted_at IS NULL AND tdc.deleted_at IS NULL
  AND drivers.deleted_at IS NULL AND auth_users.deleted_at IS NULL
  AND trucks.deleted_at IS NULL AND jobs_routes.deleted_at IS NULL
  AND jobs.deleted_at IS NULL AND customers.deleted_at IS NULL
  AND trips.status = 'FINALIZED'
`;

// ─── Groq (LLaMA 3.3) ────────────────────────────────────────────────────────
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
    throw new Error(`Serviço de IA indisponível (${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ─── Gerar SQL ────────────────────────────────────────────────────────────────
async function _gerarSQL(pergunta) {
  const system = `Você é especialista em MySQL e conhece profundamente o banco landapp_production da empresa LandApp.

${LAND_CONTEXT}

REGRAS ABSOLUTAS:
1. Retorne APENAS o SQL puro — zero markdown, zero explicação, zero blocos de código
2. SOMENTE SELECT (nunca INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE)
3. SEMPRE adicionar LIMIT 200 na query principal
4. SEMPRE filtrar deleted_at IS NULL em todas as tabelas
5. Use aliases em português para melhor leitura
6. Quando a pergunta envolver viagens, use trips.status = 'FINALIZED' salvo indicação contrária
7. Para financeiro de fretes, sempre usar trips_dry_cargo e somar todos os campos de preço`;

  const sqlRaw = await _callAI(system, `Pergunta do usuário: "${pergunta}"`);

  const sql = sqlRaw
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  const upper = sql.toUpperCase();
  const bloqueadas = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE', 'CREATE ', 'GRANT ', 'REVOKE '];
  for (const p of bloqueadas) {
    if (upper.includes(p)) throw new Error(`Operação não permitida detectada: ${p.trim()}`);
  }
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Apenas consultas de leitura são permitidas.');
  }

  return sql;
}

// ─── Formatar resposta em PT-BR ───────────────────────────────────────────────
async function _formatarResposta(pergunta, rows) {
  const system = `Você é Alfred, assistente inteligente de dados da LandApp.
Seu papel é explicar dados de viagens, fretes, obras, motoristas e veículos de forma clara.
SEMPRE responda em português brasileiro.
NUNCA mencione SQL, banco de dados, tabelas ou tecnologia.
Seja direto, objetivo e use números concretos.
Se os dados tiverem valores monetários, formate como R$ X.XXX,XX.
Se houver muitos registros, faça um resumo com destaques.`;

  const user = `Pergunta: "${pergunta}"
Resultado (${rows.length} registro(s)):
${JSON.stringify(rows.slice(0, 50), null, 2)}`;

  return await _callAI(system, user);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
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

    const sql    = await _gerarSQL(question.trim());
    const [rows] = await conn.query(sql);
    const answer = await _formatarResposta(question.trim(), rows);

    return res.status(200).json({ ok: true, answer, rowCount: rows.length, sql });

  } catch (err) {
    console.error('[Alfred] Erro:', err.message);

    let userMsg = 'Não consegui processar sua pergunta. Tente reformular.';
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      userMsg = 'Não foi possível conectar ao banco de dados.';
    } else if (err.message.includes('ER_ACCESS_DENIED')) {
      userMsg = 'Acesso ao banco negado.';
    } else if (err.message.includes('ER_NO_SUCH_TABLE') || err.message.includes('ER_BAD_FIELD')) {
      userMsg = 'Tabela ou campo não encontrado. Tente reformular sua pergunta.';
    } else if (err.message.includes('Operação não permitida')) {
      userMsg = 'Só consigo fazer consultas de leitura.';
    } else if (err.message.includes('Serviço de IA')) {
      userMsg = err.message;
    }

    return res.status(500).json({ ok: false, error: userMsg });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
};
