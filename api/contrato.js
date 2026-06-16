// Gera contrato Escola Legal em PDF: preenche campos + assinaturas sobre o layout oficial.
// E-mail com anexo via Resend (RESEND_API_KEY). Confirmação separada via EmailJS no front.
//
// Vercel — variáveis de ambiente:
//   RESEND_API_KEY ou RESEND_API = re_... (painel Resend → API Keys)
//   RESEND_FROM      = onboarding@resend.dev  (teste) ou Escola Legal <contrato@delianesantos.com> (após verificar domínio)
//   EMAIL_CC             = contato@delianesantos.com (cópia em BCC no e-mail Resend)
//   EMAILJS_PRIVATE_KEY  = chave privada (EmailJS → Account → Security → non-browser API)
//
// Teste com onboarding@resend.dev: só entrega no e-mail da conta Resend até verificar delianesantos.com em Domains.

import fs from 'fs';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { Resend } from 'resend';

const BASE_PDF = path.join(process.cwd(), 'Contrato', 'contrato-escola-legal-base.pdf');
const FONT_ASSINATURA_DRA = path.join(process.cwd(), 'Contrato', 'fonts', 'Allura-Regular.ttf');
const ASSINATURA_DRA_TEXTO = 'Deliane J Santos';
const PAGE_H = 842.52;

// Coordenadas calibradas no PDF base (PyMuPDF — origem no canto superior esquerdo).
const CAMPOS_P0 = [
  { x: 132, yTop: 201, w: 145, h: 14, key: 'instituicao', size: 10 },
  { x: 105, yTop: 219, w: 172, h: 14, key: 'cnpj', size: 10 },
  { x: 118, yTop: 237, w: 158, h: 14, key: 'endereco1', size: 10 },
  { x: 60, yTop: 255, w: 216, h: 14, key: 'endereco2', size: 10 },
  { x: 148, yTop: 273, w: 128, h: 14, key: 'representante', size: 10 },
  { x: 95, yTop: 291, w: 180, h: 14, key: 'cpf', size: 10 },
];

const ASSINATURA_CAIXAS = [
  { page: 0, x: 60, yTop: 342, w: 225, h: 30, who: 'cliente' },
  { page: 0, x: 309, yTop: 343, w: 223, h: 28, who: 'doutora' },
  { page: 1, x: 60, yTop: 753, w: 226, h: 30, who: 'cliente' },
  { page: 1, x: 310, yTop: 753, w: 226, h: 30, who: 'doutora' },
];

const DATA_ASSINATURA = { page: 1, x: 59, yTop: 695, w: 185, h: 14 };

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

function trim(str, max) {
  return (str || '').toString().trim().slice(0, max);
}

function splitEndereco(endereco) {
  const e = trim(endereco, 300);
  if (e.length <= 38) return { linha1: e, linha2: '' };
  const cut = e.lastIndexOf(',', 42);
  if (cut > 10) return { linha1: e.slice(0, cut + 1).trim(), linha2: e.slice(cut + 1).trim() };
  const sp = e.lastIndexOf(' ', 38);
  if (sp > 10) return { linha1: e.slice(0, sp).trim(), linha2: e.slice(sp).trim() };
  return { linha1: e.slice(0, 38), linha2: e.slice(38).trim() };
}

function formatDateBR(date) {
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

function yPdf(yTop, height = 0) {
  return PAGE_H - yTop - height;
}

function fitImageInBox(img, caixa, fill = 0.96) {
  const scale = Math.min(caixa.w / img.width, caixa.h / img.height) * fill;
  return {
    w: img.width * scale,
    h: img.height * scale,
  };
}

function fitTextSize(font, text, maxW, maxH, startSize = 32) {
  let size = startSize;
  while (size > 10) {
    const w = font.widthOfTextAtSize(text, size);
    const h = font.heightAtSize(size);
    if (w <= maxW && h <= maxH) return { size, w, h };
    size -= 0.5;
  }
  const sizeFinal = 10;
  return {
    size: sizeFinal,
    w: font.widthOfTextAtSize(text, sizeFinal),
    h: font.heightAtSize(sizeFinal),
  };
}

function drawDraSignatureText(page, caixa, font, color) {
  const padX = caixa.w * 0.03;
  const padY = caixa.h * 0.08;
  const { size, w, h } = fitTextSize(
    font,
    ASSINATURA_DRA_TEXTO,
    caixa.w - padX * 2,
    caixa.h - padY * 2,
    caixa.h > 28 ? 34 : 30,
  );
  page.drawText(ASSINATURA_DRA_TEXTO, {
    x: caixa.x + (caixa.w - w) / 2,
    y: yPdf(caixa.yTop, caixa.h) + (caixa.h - h) / 2 + padY * 0.35,
    size,
    font,
    color,
  });
}

function drawClienteSignatureImage(page, caixa, img) {
  const { w, h } = fitImageInBox(img, caixa, 0.96);
  page.drawImage(img, {
    x: caixa.x + (caixa.w - w) / 2,
    y: yPdf(caixa.yTop, caixa.h) + (caixa.h - h) / 2,
    width: w,
    height: h,
  });
}

function parseSignature(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  return Buffer.from(m[2], 'base64');
}

async function buildPdf(body, clienteSigBuffer) {
  if (!fs.existsSync(BASE_PDF)) throw new Error('base_pdf_missing');

  const pdfDoc = await PDFDocument.load(fs.readFileSync(BASE_PDF));
  pdfDoc.registerFontkit(fontkit);
  // Remove página 3 em branco do modelo Word.
  if (pdfDoc.getPageCount() > 2) {
    pdfDoc.removePage(2);
  }

  const pages = pdfDoc.getPages();

  const end = splitEndereco(body.endereco);
  const cpf = trim(body.cpf, 20) || '—';
  const dataAssinatura = formatDateBR(new Date());
  const valores = {
    instituicao: trim(body.nomeInstituicao, 48),
    cnpj: trim(body.cnpj, 20),
    endereco1: end.linha1,
    endereco2: end.linha2 || '',
    representante: trim(body.responsavel, 42),
    cpf,
  };

  const navy = rgb(0, 0.11, 0.24);
  const white = rgb(1, 1, 1);

  for (const campo of CAMPOS_P0) {
    const page = pages[0];
    const texto = valores[campo.key] || '';
    if (!texto) continue;
    page.drawRectangle({
      x: campo.x - 2,
      y: yPdf(campo.yTop, campo.h),
      width: campo.w,
      height: campo.h + 2,
      color: white,
      borderWidth: 0,
    });
    page.drawText(texto, {
      x: campo.x,
      y: yPdf(campo.yTop, campo.size),
      size: campo.size,
      color: navy,
    });
  }

  // Data da assinatura (substitui data fixa do modelo).
  const pData = pages[DATA_ASSINATURA.page];
  pData.drawRectangle({
    x: DATA_ASSINATURA.x - 2,
    y: yPdf(DATA_ASSINATURA.yTop, DATA_ASSINATURA.h),
    width: DATA_ASSINATURA.w,
    height: DATA_ASSINATURA.h + 2,
    color: white,
  });
  pData.drawText(`São Paulo, ${dataAssinatura}.`, {
    x: DATA_ASSINATURA.x,
    y: yPdf(DATA_ASSINATURA.yTop, 11),
    size: 11,
    color: navy,
  });

  let draFont;
  if (fs.existsSync(FONT_ASSINATURA_DRA)) {
    draFont = await pdfDoc.embedFont(fs.readFileSync(FONT_ASSINATURA_DRA));
  }

  const clienteImg = await pdfDoc.embedPng(clienteSigBuffer);

  for (const caixa of ASSINATURA_CAIXAS) {
    const page = pages[caixa.page];

    page.drawRectangle({
      x: caixa.x,
      y: yPdf(caixa.yTop, caixa.h),
      width: caixa.w,
      height: caixa.h,
      color: white,
      borderWidth: 0,
    });

    if (caixa.who === 'doutora' && draFont) {
      drawDraSignatureText(page, caixa, draFont, navy);
    } else if (caixa.who === 'cliente') {
      drawClienteSignatureImage(page, caixa, clienteImg);
    }
  }

  return pdfDoc.save();
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildContratoEmailHtml({
  responsavel,
  nomeInstituicao,
  cnpj,
  cpf,
  email,
  whatsapp,
  endereco,
  isOfficeCopy,
}) {
  const greeting = isOfficeCopy
    ? `<p style="margin:0 0 12px;font-size:15px;color:#334155;">Nova adesão registrada — cópia interna para o escritório.</p>`
    : `<p style="margin:0 0 8px;font-size:16px;color:#001D3D;">Olá, <strong>${escapeHtml(responsavel)}</strong>,</p>` +
      `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Segue em anexo o <strong>contrato assinado</strong> da assessoria <strong>Escola Legal</strong>. Guarde este documento para seus registros.</p>`;

  const rows = [
    ['Instituição', nomeInstituicao],
    ['CNPJ', cnpj],
    ['Responsável', responsavel],
    ['CPF', cpf || '—'],
    ['E-mail', email],
    ['WhatsApp', whatsapp || '—'],
    ['Endereço', endereco],
    ['Valor mensal', 'R$ 1.740,00'],
  ];

  const tableRows = rows.map(([label, value], i) =>
    `<tr style="background:${i % 2 ? '#FAF9F6' : '#ffffff'};">` +
    `<td style="padding:10px 14px;font-size:13px;font-weight:700;color:#001D3D;width:34%;border-bottom:1px solid #E8E4DC;">${escapeHtml(label)}</td>` +
    `<td style="padding:10px 14px;font-size:14px;color:#334155;border-bottom:1px solid #E8E4DC;">${escapeHtml(value)}</td>` +
    `</tr>`,
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F3F1EC;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F1EC;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,29,61,0.12);">
<tr><td style="background:linear-gradient(135deg,#001428 0%,#001D3D 55%,#002952 100%);padding:28px 32px;text-align:center;">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#C5943E;font-family:Arial,sans-serif;">Deliane Santos · Advocacia Educacional</p>
  <h1 style="margin:0;font-size:28px;font-weight:400;color:#FAF9F6;letter-spacing:0.02em;">Escola Legal</h1>
  <p style="margin:10px 0 0;font-size:14px;color:rgba(250,249,246,0.82);font-family:Arial,sans-serif;">Contrato assinado em anexo</p>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#A67A2E,#C5943E,#D4AD5E,#C5943E,#A67A2E);"></td></tr>
<tr><td style="padding:28px 32px 8px;">${greeting}</td></tr>
<tr><td style="padding:0 32px 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E8E4DC;border-radius:12px;overflow:hidden;">${tableRows}</table>
</td></tr>
<tr><td style="padding:0 32px 28px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(197,148,62,0.10);border-left:4px solid #C5943E;border-radius:8px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#001D3D;font-family:Arial,sans-serif;">
    <strong>Próximo passo:</strong> efetue o pagamento da primeira parcela via PIX. As instruções estão na página de confirmação do site.
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 32px 28px;background:#FAF9F6;border-top:1px solid #E8E4DC;text-align:center;">
  <p style="margin:0 0 4px;font-size:14px;color:#001D3D;font-weight:700;">Dra. Deliane Santos</p>
  <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,sans-serif;">contato@delianesantos.com · Advocacia Educacional</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendEmailJsConfirmation(mailData, pdfEmailSent) {
  const userId = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID || 'aBHcQ2aT5S4Q4xK8k';
  const serviceId = process.env.EMAILJS_SERVICE_ID || 'service_uq4609j';
  const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_gt5wskh';
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    template_params: {
      to_email: mailData.email,
      email: mailData.email,
      nome_responsavel: mailData.responsavel,
      nome_instituicao: mailData.nomeInstituicao,
      cnpj: mailData.cnpj,
      whatsapp: mailData.whatsapp,
      endereco: mailData.endereco,
      valor: 'R$ 1.740,00',
      mensagem: pdfEmailSent
        ? 'Recebemos sua adesão! Você receberá dois e-mails: este de confirmação e outro com o contrato assinado em PDF em anexo.'
        : 'Recebemos sua adesão! Seu contrato assinado em PDF está disponível para download na página de pagamento.',
    },
  };
  if (privateKey) payload.accessToken = privateKey;

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[EmailJS]', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EmailJS]', err);
    return false;
  }
}

function resendApiKey() {
  return process.env.RESEND_API_KEY || process.env.RESEND_API;
}

async function sendResendEmail({ to, bcc, subject, html, pdfBuffer, filename }) {
  const key = resendApiKey();
  const from = process.env.RESEND_FROM || 'Escola Legal <onboarding@resend.dev>';
  if (!key) return { ok: false, error: 'no_key' };

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    bcc: bcc && bcc.length ? bcc : undefined,
    subject,
    html,
    attachments: [{
      filename,
      content: Buffer.from(pdfBuffer).toString('base64'),
    }],
  });

  if (error) throw error;
  return { ok: true, id: data?.id };
}

async function sendContratoEmails(body, pdfBuffer, filename) {
  const office = process.env.EMAIL_CC || 'dra.delianesantosadv@gmail.com';
  const mailData = {
    responsavel: trim(body.responsavel, 120),
    nomeInstituicao: trim(body.nomeInstituicao, 200),
    cnpj: trim(body.cnpj, 20),
    cpf: trim(body.cpf, 20),
    email: trim(body.email, 120),
    whatsapp: trim(body.whatsapp, 30),
    endereco: trim(body.endereco, 300),
  };

  const subject = `Contrato Escola Legal — ${mailData.nomeInstituicao}`;
  const html = buildContratoEmailHtml({ ...mailData, isOfficeCopy: false });
  const bcc = office.toLowerCase() !== mailData.email.toLowerCase() ? [office] : undefined;

  let clientSent = false;
  let officeCopySent = false;

  try {
    await sendResendEmail({
      to: mailData.email,
      bcc,
      subject,
      html,
      pdfBuffer,
      filename,
    });
    clientSent = true;
    officeCopySent = !!bcc;
  } catch (err) {
    console.error('[Resend]', err);
    if (bcc) {
      try {
        await sendResendEmail({
          to: office,
          subject: `[Cópia] ${subject}`,
          html: buildContratoEmailHtml({ ...mailData, isOfficeCopy: true }),
          pdfBuffer,
          filename,
        });
        officeCopySent = true;
      } catch (officeErr) {
        console.error('[Resend escritório]', officeErr);
      }
    }
  }

  return { clientSent, officeCopySent, mailData };
}

async function postToGoogleWebhook(webhook, payload) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body, 'utf8')),
  };
  let currentUrl = webhook;
  for (let i = 0; i < 5; i++) {
    const response = await fetch(currentUrl, { method: 'POST', headers, body, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      continue;
    }
    const text = await response.text();
    let parsed = {};
    try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }
    return { response, parsed };
  }
  return { response: null, parsed: {} };
}

async function storeEscolaLegalLead(body, meta = {}) {
  const webhook = process.env.ESCOLA_LEGAL_WEBHOOK_URL || process.env.FICHA_VIP_WEBHOOK_URL;
  if (!webhook) return { ok: false, reason: 'missing_webhook' };

  const payload = {
    secret: process.env.FICHA_VIP_SECRET || process.env.ESCOLA_LEGAL_SECRET || '',
    origem: 'escola-legal',
    dataHora: new Date().toISOString(),
    nomeInstituicao: trim(body.nomeInstituicao, 200),
    cnpj: trim(body.cnpj, 20),
    responsavel: trim(body.responsavel, 120),
    cpf: trim(body.cpf, 20),
    email: trim(body.email, 120),
    whatsapp: trim(body.whatsapp, 30),
    endereco: trim(body.endereco, 300),
    valorMensal: 'R$ 1.740,00',
    emailContratoEnviado: meta.emailSent ? 'sim' : 'nao',
    copiaEscritorioEnviada: meta.officeCopySent ? 'sim' : 'nao',
  };

  try {
    const { response, parsed } = await postToGoogleWebhook(webhook, payload);
    return { ok: response && response.ok && parsed.ok === true };
  } catch (err) {
    console.error('[contrato][sheet]', err);
    return { ok: false, reason: 'request_failed' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = await readBody(req);
  const nomeInstituicao = trim(body.nomeInstituicao, 200);
  const responsavel = trim(body.responsavel, 120);
  const email = trim(body.email, 120);
  const cnpj = trim(body.cnpj, 20);
  const endereco = trim(body.endereco, 300);
  const signatureBuffer = parseSignature(body.assinatura);

  if (!nomeInstituicao || !responsavel || !email || !cnpj || !endereco || !signatureBuffer) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  try {
    const pdfBuffer = await buildPdf(body, signatureBuffer);
    const filename = `Contrato-Escola-Legal-${cnpj.replace(/\D/g, '') || 'adesao'}.pdf`;
    const cpf = trim(body.cpf, 20);
    const whatsapp = trim(body.whatsapp, 30);

    let emailSent = false;
    let officeCopySent = false;

    try {
      const mail = await sendContratoEmails(body, pdfBuffer, filename);
      emailSent = mail.clientSent;
      officeCopySent = mail.officeCopySent;
    } catch (mailErr) {
      console.error('[Resend]', mailErr);
    }

    const storage = await storeEscolaLegalLead(body, { emailSent, officeCopySent });

    // Confirmação EmailJS: enviada pelo navegador para o e-mail do formulário (to_email).

    res.status(200).json({
      ok: true,
      emailSent,
      emailJsSent: false,
      resendNeedsDomain: !emailSent,
      officeCopySent,
      storageOk: storage.ok,
      filename,
      pdfBase64: Buffer.from(pdfBuffer).toString('base64'),
    });
  } catch (e) {
    console.error('[contrato]', e);
    res.status(500).json({ error: e.message || 'generate_failed' });
  }
}
