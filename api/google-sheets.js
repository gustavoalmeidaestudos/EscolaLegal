// Gravação direta no Google Sheets (sem Apps Script / webhook).
// Variáveis no Vercel:
//   GOOGLE_SHEETS_ID              → ID da planilha (parte da URL)
//   GOOGLE_SERVICE_ACCOUNT_JSON   → conteúdo do JSON da conta de serviço (uma linha)

import crypto from 'crypto';

const SHEET_TAB_CANDIDATES = ['Contatos', 'Cadastros'];

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const signInput = `${header}.${claim}`;
  const privateKey = (credentials.private_key || '').replace(/\\n/g, '\n');
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signInput)
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const jwt = `${signInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'token_failed');
  }
  return data.access_token;
}

async function sheetsFetch(path, token, options = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    const msg = parsed.error?.message || parsed.raw || `http_${res.status}`;
    throw new Error(msg);
  }
  return parsed;
}

function pickTabName(sheetsMeta) {
  const titles = (sheetsMeta.sheets || []).map((s) => s.properties?.title).filter(Boolean);
  for (const candidate of SHEET_TAB_CANDIDATES) {
    if (titles.includes(candidate)) return candidate;
  }
  return SHEET_NAME_FALLBACK(titles);
}

function SHEET_NAME_FALLBACK(titles) {
  return titles[0] || 'Cadastros';
}

export function googleSheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEETS_ID && parseServiceAccount());
}

export async function appendVipRowToGoogleSheet(row) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const credentials = parseServiceAccount();
  if (!spreadsheetId || !credentials) {
    return { ok: false, reason: 'not_configured' };
  }

  const token = await getAccessToken(credentials);
  const meta = await sheetsFetch(spreadsheetId, token, { method: 'GET' });
  const tabName = pickTabName(meta);

  await sheetsFetch(
    `${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[
          row.dataHora || new Date().toISOString(),
          row.nomeInstituicao || '',
          row.cnpj || '',
          row.responsavel || '',
          row.cargo || '',
          row.cidadeEstado || '',
          row.email || '',
          row.whatsapp || '',
          row.interesse || '',
          row.demanda || '',
        ]],
      }),
    },
  );

  return {
    ok: true,
    sheet: tabName,
    spreadsheet: meta.properties?.title || spreadsheetId,
    method: 'google_sheets_api',
  };
}
