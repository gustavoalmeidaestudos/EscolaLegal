// Gera contrato Escola Legal (DOCX) com dados do formulário + assinatura desenhada.
// Anexo por e-mail via SMTP (Titan/Gmail) se configurado — sem custo de API de assinatura.
//
// Env opcional: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_CC

import fs from 'fs';
import path from 'path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import ImageModule from 'docxtemplater-image-module-free';
import nodemailer from 'nodemailer';

const TEMPLATE = path.join(process.cwd(), 'Contrato', 'contrato-escola-legal-template.docx');

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
  const cut = e.lastIndexOf(',', 38);
  if (cut > 12) return { linha1: e.slice(0, cut + 1).trim(), linha2: e.slice(cut + 1).trim() };
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

function parseSignature(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!m) return null;
  return Buffer.from(m[2], 'base64');
}

function buildDocxBuffer(body, signatureBuffer) {
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error('template_missing');
  }

  const endereco = splitEndereco(body.endereco);
  const cpf = trim(body.cpf, 20) || '________________';

  const imageOpts = {
    centered: false,
    getImage(tagValue) {
      if (tagValue === 'SIGN') return signatureBuffer;
      return signatureBuffer;
    },
    getSize() {
      return [220, 70];
    },
  };

  const zip = new PizZip(fs.readFileSync(TEMPLATE, 'binary'));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [new ImageModule(imageOpts)],
  });

  doc.render({
    instituicao: trim(body.nomeInstituicao, 48),
    cnpj: trim(body.cnpj, 20),
    endereco_linha1: endereco.linha1,
    endereco_linha2: endereco.linha2 || ' ',
    representante: trim(body.responsavel, 42),
    cpf,
    assinatura_contratante: 'SIGN',
    assinatura_contratante_final: 'SIGN',
  });

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function sendEmail({ to, cc, subject, html, attachmentBuffer, filename }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  const port = Number(process.env.SMTP_PORT || 465);

  if (!host || !user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments: [{
      filename,
      content: attachmentBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }],
  });

  return true;
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
    const docxBuffer = buildDocxBuffer(body, signatureBuffer);
    const filename = `Contrato-Escola-Legal-${cnpj.replace(/\D/g, '') || 'adesao'}.docx`;
    const cc = process.env.EMAIL_CC || 'contato@delianesantos.com';

    let emailSent = false;
    try {
      emailSent = await sendEmail({
        to: email,
        cc,
        subject: `Contrato Escola Legal — ${nomeInstituicao}`,
        html:
          `<p>Olá, <strong>${responsavel}</strong>,</p>` +
          `<p>Segue em anexo o contrato da assessoria <strong>Escola Legal</strong> referente à instituição <strong>${nomeInstituicao}</strong>.</p>` +
          `<p>Próximo passo: efetuar o pagamento da primeira parcela via PIX (instruções na página de confirmação).</p>` +
          `<p>Deliane Santos — Advocacia Educacional</p>`,
        attachmentBuffer: docxBuffer,
        filename,
      });
    } catch (mailErr) {
      console.error('[SMTP]', mailErr);
    }

    res.status(200).json({
      ok: true,
      emailSent,
      filename,
      docxBase64: docxBuffer.toString('base64'),
    });
  } catch (e) {
    console.error('[contrato]', e);
    res.status(500).json({ error: e.message || 'generate_failed' });
  }
}
