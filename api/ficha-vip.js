// API — Ficha Cadastral Grupo VIP

// Armazena submissões em planilha Google (via Apps Script) — dados NÃO ficam públicos.

// Variáveis de ambiente no Vercel:

//   FICHA_VIP_WEBHOOK_URL  → URL do Web App do Google Apps Script (scripts/ficha-vip-apps-script.gs)

//   FICHA_VIP_SECRET       → token compartilhado com o Apps Script (só no servidor)

//   GITHUB_BACKUP_TOKEN    → (opcional) token GitHub para append em backups/ficha-vip-cadastros.md

//   GITHUB_BACKUP_REPO     → (opcional) ex.: gustavoalmeidaestudos/EscolaLegal
//
//   GOOGLE_SHEETS_ID              → ID da planilha (recomendado — grava direto, sem Apps Script)
//   GOOGLE_SERVICE_ACCOUNT_JSON   → JSON da conta de serviço Google (cole inteiro em uma linha)

import { appendVipRowToGoogleSheet, googleSheetsConfigured, probeGoogleSheets, getServiceAccountEmail, fetchVipRowsFromGoogleSheet } from './google-sheets.js';

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



function resendApiKey() {
  return process.env.RESEND_API_KEY || process.env.RESEND_API;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendResendFallback(row) {
  const key = resendApiKey();
  if (!key) return false;

  const to = process.env.EMAIL_CC || process.env.FICHA_VIP_FALLBACK_EMAIL || 'dra.delianesantosadv@gmail.com';
  const from = process.env.RESEND_FROM || 'Ficha VIP <onboarding@resend.dev>';

  const rows = [
    ['Instituição', row.nomeInstituicao],
    ['CNPJ', row.cnpj],
    ['Responsável', row.responsavel],
    ['Cargo', row.cargo],
    ['Cidade/Estado', row.cidadeEstado],
    ['E-mail', row.email],
    ['WhatsApp', row.whatsapp],
    ['Interesse', row.interesse],
    ['Demanda', row.demanda || '—'],
    ['Data/Hora', row.dataHora],
  ];

  const table = rows.map(([label, value]) =>
    `<tr><td style="padding:8px 12px;font-weight:700;border:1px solid #ddd;">${escapeHtml(label)}</td>` +
    `<td style="padding:8px 12px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`
  ).join('');

  const html =
    `<h2 style="color:#001D3D;">Novo cadastro — Ficha VIP</h2>` +
    `<p>Planilha indisponível no momento. Cadastro salvo por e-mail de contingência.</p>` +
    `<table style="border-collapse:collapse;width:100%;max-width:640px;">${table}</table>`;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `Ficha VIP — ${row.nomeInstituicao}`,
      html,
    });
    if (error) {
      console.error('[ficha-vip] Resend fallback', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[ficha-vip] Resend fallback', e);
    return false;
  }
}

function isGoogleSignInUrl(url) {
  return /accounts\.google\.com/i.test(url || '');
}

async function fetchWithRedirects(url, options = {}, maxRedirects = 5) {
  let currentUrl = url;
  let method = options.method || 'GET';
  let headers = options.headers ? { ...options.headers } : {};
  let body = options.body;

  for (let i = 0; i < maxRedirects; i++) {
    const fetchOptions = { method, headers, redirect: 'manual' };
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }
    const r = await fetch(currentUrl, fetchOptions);
    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get('location');
      if (!location) return r;
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      if (isGoogleSignInUrl(currentUrl)) {
        const err = new Error('google_login_required');
        err.signInBlocked = true;
        throw err;
      }
      // Apps Script: após POST, o redirect exige GET (o body já foi recebido no 1º request).
      if (method === 'POST') {
        method = 'GET';
        body = undefined;
        const nextHeaders = { ...headers };
        delete nextHeaders['Content-Length'];
        delete nextHeaders['content-length'];
        headers = nextHeaders;
      }
      continue;
    }
    return r;
  }
  throw new Error('too_many_redirects');
}

async function postToWebhook(webhook, payload) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body, 'utf8')),
  };
  const r = await fetchWithRedirects(webhook, { method: 'POST', headers, body });
  const text = await r.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.slice(0, 300) }; }
  return { r, parsed };
}

async function pingWebhook(webhook) {

  try {

    const r = await fetchWithRedirects(webhook, { method: 'GET' });

    const text = await r.text();

    let parsed = {};

    try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }

    return {

      ok: r.ok && parsed.ok === true,

      status: r.status,

      detail: parsed.error || (parsed.ok === true ? 'ok' : text.slice(0, 160)),

      parsed,

      problem: text.includes('accounts.google.com') || text.includes('signin')
        ? 'google_login_required'
        : (parsed.ok === true ? null : 'webhook_error'),

    };

  } catch (e) {

    return {
      ok: false,
      status: 0,
      detail: String(e.message || e),
      problem: e.signInBlocked || e.message === 'google_login_required'
        ? 'google_login_required'
        : 'network_error',
    };

  }

}

async function probeWebhookSecret(webhook, secret) {
  if (!webhook || !secret) {
    return { ok: false, problem: 'secret_not_configured' };
  }
  try {
    const probeBody = JSON.stringify({ secret, probe: 'secret' });
    const r = await fetchWithRedirects(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(probeBody, 'utf8')),
      },
      body: probeBody,
    });
    const text = await r.text();
    let parsed = {};
    try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }
    if (parsed.probe === 'secret_ok' && parsed.ok === true) {
      return { ok: true };
    }
    if (parsed.error === 'forbidden') {
      return { ok: false, problem: 'secret_mismatch' };
    }
    return {
      ok: false,
      problem: 'webhook_error',
      detail: parsed.error || text.slice(0, 160),
    };
  } catch (e) {
    return {
      ok: false,
      problem: e.signInBlocked || e.message === 'google_login_required'
        ? 'google_login_required'
        : 'network_error',
      detail: String(e.message || e),
    };
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

    const exportKind = req.query?.export;
    const exportKey = req.query?.key || req.headers['x-ficha-secret'] || '';
    if (exportKind === 'cadastros' && secretSet && exportKey === process.env.FICHA_VIP_SECRET) {
      if (!googleSheetsConfigured()) {
        res.status(503).json({ ok: false, error: 'google_sheets_not_configured' });
        return;
      }
      try {
        const data = await fetchVipRowsFromGoogleSheet();
        if (!data.ok) {
          res.status(502).json({ ok: false, error: 'export_failed' });
          return;
        }
        res.status(200).json({ ok: true, ...data });
        return;
      } catch (e) {
        res.status(502).json({ ok: false, error: String(e.message || e) });
        return;
      }
    }

    const health = {

      ok: true,

      storageConfigured: googleSheetsConfigured() || Boolean(webhook),

      googleSheetsConfigured: googleSheetsConfigured(),

      googleSheetsServiceAccount: getServiceAccountEmail(),

      secretConfigured: secretSet,

      webhookReachable: false,

      secretValid: null,

      webhookDetail: null,

    };

    if (googleSheetsConfigured()) {
      const sheetsProbe = await probeGoogleSheets();
      health.googleSheetsReachable = sheetsProbe.ok;
      if (sheetsProbe.ok) {
        health.spreadsheet = sheetsProbe.spreadsheet;
        health.sheet = sheetsProbe.sheet;
      } else {
        health.googleSheetsProblem = sheetsProbe.problem;
        health.googleSheetsDetail = sheetsProbe.detail;
        health.googleSheetsFix = sheetsProbe.fix;
        health.ok = false;
      }
    }

    if (webhook) {

      const ping = await pingWebhook(webhook);

      health.webhookReachable = ping.ok;

      health.webhookDetail = ping.detail;

      health.webhookStatus = ping.status;

      health.webhookProblem = ping.problem || null;

      if (ping.parsed && ping.parsed.spreadsheet) {
        health.spreadsheet = ping.parsed.spreadsheet;
      }

      if (secretSet) {
        const probe = await probeWebhookSecret(webhook, process.env.FICHA_VIP_SECRET);
        health.secretValid = probe.ok;
        if (!probe.ok) {
          health.secretProblem = probe.problem;
          health.secretDetail = probe.detail || null;
        }
      }

      if (ping.problem === 'google_login_required' || health.secretProblem === 'google_login_required') {
        health.fix = 'No Apps Script: Implantar > Gerenciar implantações > editar > Quem pode acessar = Qualquer pessoa. Depois copie a URL /exec para FICHA_VIP_WEBHOOK_URL no Vercel.';
      } else if (health.secretValid === false && health.secretProblem === 'secret_mismatch') {
        health.fix = 'O SECRET no Apps Script (const SECRET = "...") deve ser EXATAMENTE igual ao FICHA_VIP_SECRET no Vercel. Depois: Implantar > Nova implantação.';
        health.ok = false;
      } else if (ping.problem === 'webhook_error' && ping.detail === 'forbidden') {
        health.fix = 'O SECRET do Apps Script deve ser igual ao FICHA_VIP_SECRET no Vercel.';
      }

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



  if (!googleSheetsConfigured() && !webhook) {

    console.warn('[ficha-vip] Nenhum armazenamento configurado', row);

    res.status(503).json({ ok: false, error: 'storage_not_configured' });

    return;

  }



  try {

    let sheetsApiError = null;

    if (googleSheetsConfigured()) {
      try {
        const sheetResult = await appendVipRowToGoogleSheet(row);
        if (sheetResult.ok) {
          try { await appendGithubMarkdownBackup(row); } catch (e) { /* opcional */ }
          res.status(200).json({
            ok: true,
            storage: 'google_sheets',
            sheet: sheetResult.sheet,
            spreadsheet: sheetResult.spreadsheet,
          });
          return;
        }
      } catch (e) {
        sheetsApiError = e;
        console.error('[ficha-vip] Google Sheets API', e);
        const detail = String(e.message || e);
        const emailed = await sendResendFallback(row);
        const fix = /permission|denied|403/i.test(detail)
          ? `Compartilhe a planilha com ${getServiceAccountEmail()} como Editor.`
          : 'Confira GOOGLE_SHEETS_ID e GOOGLE_SERVICE_ACCOUNT_JSON no Vercel.';
        if (emailed) {
          res.status(200).json({ ok: true, storage: 'email', warning: 'sheets_api_failed', detail, fix });
          return;
        }
        res.status(502).json({ ok: false, error: 'sheets_api_failed', detail, fix });
        return;
      }
    }

    if (!webhook) {
      const emailed = await sendResendFallback(row);
      if (emailed) {
        res.status(200).json({ ok: true, storage: 'email', warning: 'sheets_api_failed' });
        return;
      }
      res.status(502).json({
        ok: false,
        error: 'sheets_api_failed',
        detail: String(sheetsApiError?.message || sheetsApiError || 'unknown'),
      });
      return;
    }

    const { r, parsed } = await postToWebhook(webhook, { secret, ...row });

    if (!r.ok || parsed.ok !== true) {
      const detail = parsed.error || parsed.raw || `http_${r.status}`;
      console.error('[ficha-vip] Webhook falhou', r.status, detail);

      const emailed = await sendResendFallback(row);
      if (emailed) {
        res.status(200).json({
          ok: true,
          storage: 'email',
          warning: detail === 'forbidden' ? 'secret_mismatch' : 'webhook_failed',
        });
        return;
      }

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



    res.status(200).json({
      ok: true,
      sheet: parsed.sheet || null,
      spreadsheet: parsed.spreadsheet || null,
    });

  } catch (e) {

    console.error('[ficha-vip] Erro ao enviar para planilha', e);

    if (e.signInBlocked || e.message === 'google_login_required') {
      res.status(502).json({
        ok: false,
        error: 'google_login_required',
        detail: 'O Google está pedindo login. Reimplante o Apps Script com acesso Qualquer pessoa e atualize a URL /exec no Vercel.',
      });
      return;
    }

    res.status(500).json({ ok: false, error: 'server_error' });

  }

}

