// API — Ficha Cadastral Grupo VIP
// Armazena submissões em planilha Google (via Apps Script) — dados NÃO ficam públicos.
// Variáveis de ambiente no Vercel:
//   FICHA_VIP_WEBHOOK_URL  → URL do Web App do Google Apps Script (scripts/ficha-vip-apps-script.gs)
//   FICHA_VIP_SECRET       → token opcional para reduzir spam (mesmo valor no Apps Script)

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ficha-Secret');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const secret = process.env.FICHA_VIP_SECRET;
  if (secret) {
    const header = req.headers['x-ficha-secret'];
    if (header !== secret) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }
  }

  const body = await readBody(req);
  const row = {
    dataHora: new Date().toISOString(),
    nomeInstituicao: clean(body.nomeInstituicao, 200),
    cnpj: clean(body.cnpj, 20),
    responsavel: clean(body.responsavel, 120),
    cargo: clean(body.cargo, 80),
    cidadeEstado: clean(body.cidadeEstado, 80),
    email: clean(body.email, 120),
    whatsapp: clean(body.whatsapp, 20),
    interesse: clean(body.interesse, 120),
    demanda: clean(body.demanda, 2000),
  };

  const required = ['nomeInstituicao', 'cnpj', 'responsavel', 'cargo', 'cidadeEstado', 'email', 'whatsapp', 'interesse'];
  const missing = required.filter((k) => !row[k]);
  if (missing.length) {
    res.status(400).json({ ok: false, error: 'missing_fields', fields: missing });
    return;
  }

  const webhook = process.env.FICHA_VIP_WEBHOOK_URL;
  if (!webhook) {
    console.warn('[ficha-vip] FICHA_VIP_WEBHOOK_URL não configurada', row);
    res.status(503).json({ ok: false, error: 'storage_not_configured' });
    return;
  }

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, ...row }),
    });
    const text = await r.text();
    let parsed = {};
    try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

    if (!r.ok || parsed.ok === false) {
      console.error('[ficha-vip] Webhook falhou', r.status, parsed);
      res.status(502).json({ ok: false, error: 'webhook_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[ficha-vip] Erro ao enviar para planilha', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
