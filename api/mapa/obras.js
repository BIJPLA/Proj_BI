'use strict';
/**
 * LandMap — Vercel Serverless Function
 * Retorna obras Terra (Traçado) com rotas e flag Aterro Zero
 * Banco: landapp_production via MySQL
 */

const mysql = require('mysql2/promise');

// ─── Credenciais (mesma base64 do Alfred) ─────────────────────────────────────
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

// ─── Detectar colunas de coordenadas na tabela places ─────────────────────────
async function _detectCoordCols(conn) {
  const [rows] = await conn.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'places'
      AND COLUMN_NAME  IN ('lat','lng','latitude','longitude','lon')
  `);
  const cols = rows.map(r => r.COLUMN_NAME);
  const latCol = cols.includes('lat')      ? 'lat'
               : cols.includes('latitude') ? 'latitude'
               : null;
  const lngCol = cols.includes('lng')       ? 'lng'
               : cols.includes('longitude') ? 'longitude'
               : cols.includes('lon')       ? 'lon'
               : null;
  return { latCol, lngCol };
}

// ─── Handler principal ────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  let conn;
  try {
    conn = await mysql.createConnection({
      host:               _cfg.h,
      port:               _cfg.p,
      user:               _cfg.u,
      password:           _cfg.w,
      database:           _cfg.d,
      ssl:                { rejectUnauthorized: false },
      connectTimeout:     15000,
      multipleStatements: false,
    });

    // ── 1. Detectar colunas lat/lng ──────────────────────────────────────────
    const { latCol, lngCol } = await _detectCoordCols(conn);
    const latExpr = latCol ? `P.${latCol}` : 'NULL';
    const lngExpr = lngCol ? `P.${lngCol}` : 'NULL';

    // ── 2. Obras com viagens Traçado ─────────────────────────────────────────
    //    Filtra: trucks.type LIKE 'TRA%ADO' (Traçado com ou sem cedilha/acento)
    //    Aterro Zero: place_id da obra já apareceu como target_place_id em alguma rota
    const obrasSQL = `
      SELECT
        J.place_id                             AS id_obra,
        P.name                                 AS obra_nome,
        C.name                                 AS cliente,
        JR.volume_type                         AS volume_type_raw,
        P.city                                 AS city,
        P.neighborhood                         AS neighborhood,
        P.region                               AS region,
        ${latExpr}                             AS lat,
        ${lngExpr}                             AS lng,
        MAX(T.begin_at)                        AS ultima_data_rota,
        MAX(T.finalized_at)                    AS ultima_data_base,
        CASE WHEN EXISTS (
          SELECT 1 FROM jobs_routes JR2
          WHERE JR2.target_place_id = J.place_id
            AND JR2.deleted_at IS NULL
        ) THEN 1 ELSE 0 END                    AS aterro_zero
      FROM trips T
      INNER JOIN jobs_routes JR ON JR.id = T.job_route_id
      INNER JOIN jobs        J  ON J.id  = JR.job_id
      INNER JOIN customers   C  ON C.id  = J.customer_id
      INNER JOIN trucks      K  ON K.id  = T.truck_id
      INNER JOIN places      P  ON P.id  = J.place_id
      WHERE T.deleted_at  IS NULL
        AND JR.deleted_at IS NULL
        AND J.deleted_at  IS NULL
        AND C.deleted_at  IS NULL
        AND K.deleted_at  IS NULL
        AND T.status = 'FINALIZED'
        AND UPPER(K.type) LIKE 'TRA%ADO'
      GROUP BY
        J.place_id, P.name, C.name, JR.volume_type,
        P.city, P.neighborhood, P.region,
        ${latExpr}, ${lngExpr}
      ORDER BY P.name ASC
    `;

    // ── 3. Rotas das obras Traçado ────────────────────────────────────────────
    //    Agrupado por rota (JR.id) — preços do jobs_routes
    const rotasSQL = `
      SELECT
        J.place_id                   AS id_obra,
        JR.id                        AS id_rota,
        JR.name                      AS rota_nome,
        PDest.name                   AS destino_nome,
        JR.customer_price            AS preco_cliente,
        JR.route_cost_price          AS preco_destino,
        AVG(T.driver_price)          AS preco_motorista,
        JR.volume_type               AS volume_type_raw,
        MAX(T.begin_at)              AS ultima_data_rota
      FROM trips T
      INNER JOIN jobs_routes JR   ON JR.id  = T.job_route_id
      INNER JOIN jobs        J    ON J.id   = JR.job_id
      INNER JOIN trucks      K    ON K.id   = T.truck_id
      INNER JOIN places      PDest ON PDest.id = JR.target_place_id
      WHERE T.deleted_at  IS NULL
        AND JR.deleted_at IS NULL
        AND J.deleted_at  IS NULL
        AND K.deleted_at  IS NULL
        AND T.status = 'FINALIZED'
        AND UPPER(K.type) LIKE 'TRA%ADO'
      GROUP BY
        J.place_id, JR.id, JR.name, PDest.name,
        JR.customer_price, JR.route_cost_price, JR.volume_type
      ORDER BY J.place_id, MAX(T.begin_at) DESC
    `;

    const [[obrasRows], [rotasRows]] = await Promise.all([
      conn.execute(obrasSQL),
      conn.execute(rotasSQL),
    ]);

    // ── 4. Agrupar rotas por id_obra ─────────────────────────────────────────
    const rotasByObra = {};
    for (const r of rotasRows) {
      const key = r.id_obra;
      if (!rotasByObra[key]) rotasByObra[key] = [];
      rotasByObra[key].push({
        rota_nome:        r.rota_nome    ?? null,
        destino_nome:     r.destino_nome ?? null,
        preco_cliente:    r.preco_cliente  != null ? Number(r.preco_cliente)  : null,
        preco_motorista:  r.preco_motorista != null ? Number(r.preco_motorista) : null,
        preco_destino:    r.preco_destino  != null ? Number(r.preco_destino)  : null,
        volume_type_raw:  r.volume_type_raw ?? null,
        ultima_data_rota: r.ultima_data_rota ? _fmtDate(r.ultima_data_rota) : null,
      });
    }

    // ── 5. Montar array final de obras ────────────────────────────────────────
    let ultimaDataBase = null;
    const obras = obrasRows.map(o => {
      const udb = o.ultima_data_base;
      if (udb && (!ultimaDataBase || udb > ultimaDataBase)) ultimaDataBase = udb;
      return {
        id_obra:          o.id_obra,
        obra_nome:        o.obra_nome    ?? '—',
        cliente:          o.cliente      ?? '—',
        volume_type_raw:  o.volume_type_raw ?? null,
        city:             o.city         ?? null,
        neighborhood:     o.neighborhood ?? null,
        region:           o.region       ?? null,
        lat:              o.lat  != null ? Number(o.lat)  : null,
        lng:              o.lng  != null ? Number(o.lng)  : null,
        ultima_data_rota: o.ultima_data_rota ? _fmtDate(o.ultima_data_rota) : null,
        aterro_zero:      o.aterro_zero === 1,
        rotas:            rotasByObra[o.id_obra] ?? [],
      };
    });

    return res.status(200).json({
      ok:               true,
      ultima_data_base: ultimaDataBase ? _fmtDate(ultimaDataBase) : null,
      total:            obras.length,
      obras,
    });

  } catch (err) {
    console.error('[mapa/obras] erro:', err.message);
    return res.status(500).json({ ok: false, error: 'Erro ao consultar obras.' });
  } finally {
    if (conn) try { await conn.end(); } catch (_) {}
  }
};

// ─── Formatar date/datetime como string ISO simples ───────────────────────────
function _fmtDate(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return String(d);
}
