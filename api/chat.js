// Vercel Serverless Function — Classificador de intenção do chat de Suporte.
// Função: dada a mensagem do usuário e a lista de tópicos (vinda do front),
// retorna SOMENTE o id do tópico mais adequado, ou "none".
// A IA NÃO gera conteúdo — apenas roteia para uma resposta pré-escrita.
// A chave fica no ambiente do Vercel (NUNCA no front): process.env.GEMINI_API_KEY

const MODEL = 'gemini-2.0-flash';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ id: 'none', error: 'method_not_allowed' });
    return;
  }

  const body = await readBody(req);
  const model = (body.model && /^[a-z0-9.\-]+$/i.test(body.model)) ? body.model : MODEL;
  const message = (body.message || '').toString().trim().slice(0, 500);
  const topics = Array.isArray(body.topics) ? body.topics.slice(0, 30) : [];
  const validIds = topics.map((t) => String(t.id));

  if (!message || topics.length === 0) {
    res.status(200).json({ id: 'none' });
    return;
  }

  const key = process.env.GEMINI_API_KEY || process.env.Gemini || process.env.GEMINI
    || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY;
  if (!key) {
    // Sem chave configurada: devolve "none" (o front cai no fallback WhatsApp).
    res.status(200).json({ id: 'none', reason: 'no_key' });
    return;
  }

  const topicList = topics.map((t) => `- ${t.id}: ${t.desc}`).join('\n');
  const prompt =
    'Você é um CLASSIFICADOR DE INTENÇÃO para o chat de suporte do site da advogada educacional Deliane Santos.\n' +
    'Sua ÚNICA tarefa é identificar a qual tópico a mensagem do usuário se refere.\n' +
    'NÃO escreva respostas, NÃO explique, NÃO invente. Responda apenas com o id.\n\n' +
    'Tópicos disponíveis (id: descrição):\n' + topicList + '\n\n' +
    'Regras:\n' +
    '- Responda SOMENTE com o id exato de um tópico acima.\n' +
    '- Se a mensagem não se encaixar claramente em nenhum tópico, responda exatamente: none\n' +
    '- Não use aspas, pontuação ou texto extra.\n\n' +
    'Mensagem do usuário: "' + message + '"\n' +
    'id:';

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 12 }
      })
    });

    if (!r.ok) {
      let detail = '';
      try { detail = await r.text(); } catch (e) { detail = ''; }
      res.status(200).json({ id: 'none', reason: 'api_error_' + r.status, detail: detail.slice(0, 400) });
      return;
    }

    const data = await r.json();
    let out = '';
    try { out = data.candidates[0].content.parts[0].text || ''; } catch (e) { out = ''; }
    out = out.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();

    const id = validIds.indexOf(out) !== -1 ? out : 'none';
    res.status(200).json({ id: id });
  } catch (e) {
    res.status(200).json({ id: 'none', reason: 'exception' });
  }
}
