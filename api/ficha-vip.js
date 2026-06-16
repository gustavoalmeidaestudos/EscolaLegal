// API — Ficha Cadastral Grupo VIP

// Armazena submissões em planilha Google (via Apps Script) — dados NÃO ficam públicos.

// Variáveis de ambiente no Vercel:

//   FICHA_VIP_WEBHOOK_URL  → URL do Web App do Google Apps Script (scripts/ficha-vip-apps-script.gs)

//   FICHA_VIP_SECRET       → token compartilhado com o Apps Script (só no servidor)

//   GITHUB_BACKUP_TOKEN    → (opcional) token GitHub para append em backups/ficha-vip-cadastros.md

//   GITHUB_BACKUP_REPO     → (opcional) ex.: gustavoalmeidaestudos/EscolaLegal



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



function formatMarkdownEntry(row) {

  const lines = [

    `## ${row.dataHora}`,

    '',

    `- **Instituição:** ${row.nomeInstituicao}`,

    `- **CNPJ:** ${row.cnpj}`,

    `- **Responsável:** ${row.responsavel}`,

    `- **Cargo:** ${row.cargo}`,

    `- **Cidade/Estado:** ${row.cidadeEstado}`,

    `- **E-mail:** ${row.email}`,

    `- **WhatsApp:** ${row.whatsapp}`,

    `- **Interesse:** ${row.interesse}`,

  ];

  if (row.demanda) lines.push(`- **Demanda:** ${row.demanda}`);

  lines.push('');

  return lines.join('\n');

}



function prependMarkdownEntry(existing, entry) {

  const marker = '\n---\n\n';

  const headerEnd = existing.indexOf(marker);

  if (headerEnd === -1) {

    return `${existing.trimEnd()}\n\n---\n\n${entry}`;

  }

  const header = existing.slice(0, headerEnd + marker.length);

  const rest = existing.slice(headerEnd + marker.length);

  return `${header}${entry}---\n\n${rest}`;

}



async function appendGithubMarkdownBackup(row) {

  const token = process.env.GITHUB_BACKUP_TOKEN;

  if (!token) return;



  const repo = process.env.GITHUB_BACKUP_REPO || 'gustavoalmeidaestudos/EscolaLegal';

  const filePath = 'backups/ficha-vip-cadastros.md';

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const entry = formatMarkdownEntry(row);



  const headers = {

    Authorization: `Bearer ${token}`,

    Accept: 'application/vnd.github+json',

    'X-GitHub-Api-Version': '2022-11-28',

    'Content-Type': 'application/json',

  };



  let sha = null;

  let existing = '';



  const getRes = await fetch(apiUrl, { headers });

  if (getRes.ok) {

    const data = await getRes.json();

    sha = data.sha;

    existing = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');

  } else if (getRes.status !== 404) {

    console.warn('[ficha-vip] GitHub backup GET falhou', getRes.status);

    return;

  }



  const newContent = prependMarkdownEntry(existing, entry);

  const body = {

    message: `backup ficha vip: ${row.nomeInstituicao}`,

    content: Buffer.from(newContent, 'utf8').toString('base64'),

  };

  if (sha) body.sha = sha;



  const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });

  if (!putRes.ok) {

    console.warn('[ficha-vip] GitHub backup PUT falhou', putRes.status);

  }

}



async function pingWebhook(webhook) {

  try {

    const r = await fetch(webhook, { method: 'GET', redirect: 'follow' });

    const text = await r.text();

    let parsed = {};

    try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }

    return {

      ok: r.ok && parsed.ok === true,

      status: r.status,

      detail: parsed.error || (parsed.ok === true ? 'ok' : text.slice(0, 160)),

    };

  } catch (e) {

    return { ok: false, status: 0, detail: String(e.message || e) };

  }

}



export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');



  if (req.method === 'OPTIONS') {

    res.status(204).end();

    return;

  }



  const webhook = process.env.FICHA_VIP_WEBHOOK_URL || '';

  const secretSet = Boolean(process.env.FICHA_VIP_SECRET);



  if (req.method === 'GET') {

    const health = {

      ok: true,

      storageConfigured: Boolean(webhook),

      secretConfigured: secretSet,

      webhookReachable: false,

      webhookDetail: null,

    };

    if (webhook) {

      const ping = await pingWebhook(webhook);

      health.webhookReachable = ping.ok;

      health.webhookDetail = ping.detail;

      health.webhookStatus = ping.status;

    }

    res.status(200).json(health);

    return;

  }



  if (req.method !== 'POST') {

    res.status(405).json({ ok: false, error: 'method_not_allowed' });

    return;

  }



  const secret = process.env.FICHA_VIP_SECRET || '';



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

      redirect: 'follow',

    });

    const text = await r.text();

    let parsed = {};

    try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.slice(0, 300) }; }



    if (!r.ok || parsed.ok !== true) {

      const detail = parsed.error || parsed.raw || `http_${r.status}`;

      console.error('[ficha-vip] Webhook falhou', r.status, detail);

      res.status(502).json({

        ok: false,

        error: detail === 'forbidden' ? 'secret_mismatch' : 'webhook_failed',

        detail,

        googleStatus: r.status,

      });

      return;

    }



    try {

      await appendGithubMarkdownBackup(row);

    } catch (e) {

      console.warn('[ficha-vip] GitHub backup falhou (planilha OK)', e);

    }



    res.status(200).json({ ok: true });

  } catch (e) {

    console.error('[ficha-vip] Erro ao enviar para planilha', e);

    res.status(500).json({ ok: false, error: 'server_error' });

  }

}

