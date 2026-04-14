const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { config, missingRuntimeConfig } = require('./backend/config');
const { runQuestion } = require('./backend/agent');
const { testConnection } = require('./backend/db');
const { invalidateSchemaCache } = require('./backend/schema');

const app = express();
const ROOT_DIR = __dirname;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  const missing = missingRuntimeConfig();
  let dbOk = false;

  if (!missing.filter(item => item.startsWith('DB_')).length) {
    try {
      dbOk = await testConnection();
    } catch (error) {
      dbOk = false;
    }
  }

  res.json({
    ok: missing.length === 0 && dbOk,
    app: 'Alfred DB Agent',
    dbOk,
    missingConfig: missing
  });
});

app.post('/api/alfred/ask', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    const portalContext = req.body?.portalContext || {};

    if (!question) {
      return res.status(400).json({ ok: false, error: 'Pergunta vazia.' });
    }

    const missing = missingRuntimeConfig();
    if (missing.length) {
      return res.status(500).json({
        ok: false,
        error: `Configuração pendente: ${missing.join(', ')}`
      });
    }

    const result = await runQuestion(question, portalContext);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Erro /api/alfred/ask:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno ao consultar o Alfred.'
    });
  }
});

app.post('/api/admin/schema/refresh', async (req, res) => {
  invalidateSchemaCache();
  res.json({ ok: true });
});

app.use(express.static(ROOT_DIR, {
  extensions: ['html']
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`🚀 Alfred rodando em http://localhost:${config.port}`);
});
