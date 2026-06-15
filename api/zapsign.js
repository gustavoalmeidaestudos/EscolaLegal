// Vercel Serverless — gera contrato ZapSign a partir do formulário Escola Legal.
// Env: ZAPSIGN_API_TOKEN, ZAPSIGN_TEMPLATE_ID

const ZAPSIGN_URL = 'https://api.zapsign.com.br/api/v1/models/create-doc/';
const VALOR_MENSAL = '1.734,00';
const VALOR_EXTENSO = 'mil, setecentos e trinta e quatro reais';
const DIA_VENCIMENTO = '10';

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

function parsePhone(raw) {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  return { country: '55', number: digits.slice(0, 11) };
}

function formatDateBR(date) {
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

function contractEndDate(now) {
  const year = now.getFullYear();
  const end = new Date(`${year}-12-20T12:00:00-03:00`);
  if (now > end) return `20 de dezembro de ${year + 1}`;
  return `20 de dezembro de ${year}`;
}

function buildTemplateData(body) {
  const now = new Date();
  const nomeInstituicao = trim(body.nomeInstituicao, 200);
  const nomeCurto = trim(body.nomeCurto, 120) || nomeInstituicao;
  const responsavel = trim(body.responsavel, 120);
  const email = trim(body.email, 120);
  const whatsapp = trim(body.whatsapp, 30);
  const cnpj = trim(body.cnpj, 20);
  const endereco = trim(body.endereco, 300);

  return [
    { de: '{{NOME DA INSTITUIÇÃO}}', para: nomeInstituicao },
    { de: '{{NOME CURTO DA INSTITUIÇÃO}}', para: nomeCurto },
    { de: '{{CNPJ}}', para: cnpj },
    { de: '{{ENDEREÇO}}', para: endereco },
    { de: '{{VALOR MENSAL}}', para: VALOR_MENSAL },
    { de: '{{VALOR POR EXTENSO}}', para: VALOR_EXTENSO },
    { de: '{{DIA VENCIMENTO}}', para: DIA_VENCIMENTO },
    { de: '{{DATA FIM VIGÊNCIA}}', para: contractEndDate(now) },
    { de: '{{DATA}}', para: formatDateBR(now) },
    { de: '{{NOME DO RESPONSÁVEL}}', para: responsavel },
    { de: '{{E-MAIL}}', para: email },
    { de: '{{WHATSAPP}}', para: whatsapp },
  ];
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

  const token = process.env.ZAPSIGN_API_TOKEN;
  const templateId = process.env.ZAPSIGN_TEMPLATE_ID;

  if (!token || !templateId) {
    res.status(503).json({ error: 'zapsign_not_configured' });
    return;
  }

  const body = await readBody(req);
  const nomeInstituicao = trim(body.nomeInstituicao, 200);
  const responsavel = trim(body.responsavel, 120);
  const email = trim(body.email, 120);
  const cnpj = trim(body.cnpj, 20);
  const endereco = trim(body.endereco, 300);
  const phone = parsePhone(body.whatsapp);

  if (!nomeInstituicao || !responsavel || !email || !cnpj || !endereco || phone.number.length < 10) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  const payload = {
    template_id: templateId,
    signer_name: responsavel,
    signer_email: email,
    signer_phone_country: phone.country,
    signer_phone_number: phone.number,
    lang: 'pt-br',
    send_automatic_email: false,
    external_id: cnpj.replace(/\D/g, '').slice(0, 20),
    data: buildTemplateData(body),
  };

  try {
    const r = await fetch(ZAPSIGN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      res.status(r.status >= 500 ? 502 : 400).json({
        error: 'zapsign_api_error',
        detail: data.detail || data.message || data.error || null,
      });
      return;
    }

    const signUrl = data.signers && data.signers[0] && data.signers[0].sign_url;
    if (!signUrl) {
      res.status(502).json({ error: 'no_sign_url' });
      return;
    }

    res.status(200).json({ sign_url: signUrl, doc_token: data.token || null });
  } catch (e) {
    res.status(502).json({ error: 'zapsign_unreachable' });
  }
}
