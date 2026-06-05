/* ============================================================
   Widget flutuante: Suporte (chat FAQ) + WhatsApp
   Drop-in: <script src="chat-widget.js" defer></script>
   Não usa chave de API — respostas pré-escritas (humanizadas).
   ============================================================ */
(function () {
  var WA = 'https://wa.me/5511957542911';
  var AVATAR = 'Logo/Logo-chat.png';

  var FAQ = [
    {
      id: 'escola_legal',
      chip: 'O que é a Escola Legal?',
      desc: 'O que é a assessoria jurídica Escola Legal / o programa de assessoria',
      keys: ['escola legal', 'assessoria', 'assessoria juridica', 'programa', 'o que e a escola'],
      a: 'A <strong>Escola Legal</strong> é a assessoria jurídica completa, personalizada e contínua da Dra. Deliane Santos para escolas que buscam crescimento, segurança, organização e fortalecimento institucional. 💼<br><br>Conheça os detalhes aqui: <a class="dsw-link" href="escola-legal.html">página da Escola Legal</a>.'
    },
    {
      id: 'valores',
      chip: 'Valores e condições',
      desc: 'Preço, valores, mensalidade, condição de adesão, formas de pagamento, PIX',
      keys: ['valor', 'valores', 'preco', 'preço', 'quanto custa', 'mensalidade', 'condicao', 'condição', 'adesao', 'adesão', 'pagamento', 'pix'],
      a: 'As condições de adesão da <strong>Escola Legal</strong> são exclusivas para escolas parceiras, com oferta especial para as primeiras aderentes. 💛<br><br>Os valores e o pagamento (inclusive via PIX) ficam na <a class="dsw-link" href="escola-legal.html">página da Escola Legal</a>.'
    },
    {
      id: 'cafe',
      chip: 'O que é o Café com a Lei?',
      desc: 'O que é o evento/encontro Café com a Lei',
      keys: ['cafe com a lei', 'café com a lei', 'cafe', 'café', 'encontro', 'evento', 'palestra'],
      a: 'O <strong>Café com a Lei</strong> são encontros matinais, um sábado por mês, com conversas objetivas sobre temas jurídicos do dia a dia escolar. ☕⚖️<br><br>A edição especial é sobre a <strong>NR1 nas Instituições de Ensino</strong>. Veja na <a class="dsw-link" href="cafe-com-a-lei.html">página do Café com a Lei</a>.'
    },
    {
      id: 'inscricao',
      chip: 'Como me inscrevo no Café com a Lei?',
      desc: 'Como se inscrever / participar / garantir vaga no Café com a Lei',
      keys: ['inscrever', 'inscricao', 'inscrição', 'participar', 'vaga', 'me inscrevo', 'como participo'],
      a: 'É só preencher o formulário na <a class="dsw-link" href="cafe-com-a-lei.html#inscricao">página do Café com a Lei</a>. ✍️<br><br>As vagas são prioritárias às escolas do grupo, então vale garantir logo a sua.'
    },
    {
      id: 'nr1',
      chip: 'O que é a NR1?',
      desc: 'O que é a NR1, norma regulamentadora, gerenciamento de riscos',
      keys: ['nr1', 'nr 1', 'norma', 'risco', 'riscos'],
      a: 'A <strong>NR1</strong> trouxe novas obrigações para as instituições de ensino, especialmente sobre gerenciamento de riscos e saúde organizacional. 📋<br><br>No <strong>Café com a Lei</strong> a Dra. Deliane explica, na prática, como a sua escola pode se adequar.'
    },
    {
      id: 'contato',
      chip: 'Falar com a Dra. Deliane',
      desc: 'Falar com um humano, contato, telefone, WhatsApp, agendar, atendimento, e-mail, horários',
      keys: ['falar', 'contato', 'atendimento', 'telefone', 'whatsapp', 'humano', 'pessoa', 'agendar', 'reuniao', 'reunião', 'horario', 'horário', 'email', 'e-mail'],
      a: 'Claro! O atendimento direto é feito pela nossa equipe. 😊 Toque no botão abaixo que você fala com a gente no WhatsApp.',
      wa: true
    }
  ];

  var FALLBACK = 'Essa eu prefiro não responder por aqui pra não te passar nada impreciso. 🙏<br><br>O melhor é falar diretamente com a nossa equipe:';

  var WA_ICON = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.515zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>';

  var CSS = ''
    + '.dsw-fab-wrap{position:fixed;right:18px;bottom:18px;z-index:90;display:flex;flex-direction:column;gap:12px;align-items:center;}'
    + '.dsw-fab{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(0,0,0,0.28);transition:transform .2s;padding:0;}'
    + '.dsw-fab:hover{transform:scale(1.08);}'
    + '.dsw-fab-wa{background:#25D366;}'
    + '.dsw-fab-wa svg{width:30px;height:30px;}'
    + '.dsw-fab-chat{background:#001D3D;border:2px solid #C5943E;position:relative;color:#D4AD5E;}'
    + '.dsw-fab-chat svg{width:27px;height:27px;}'
    + '.dsw-fab-badge{position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:#25D366;border:2px solid #fff;animation:dsw-blink 1.6s ease-in-out infinite;}'
    + '@keyframes dsw-blink{0%,100%{opacity:1;}50%{opacity:.4;}}'
    + '.dsw-panel{position:fixed;right:18px;bottom:86px;z-index:95;width:360px;max-width:calc(100vw - 36px);height:min(72vh,560px);background:#fff;border:1px solid rgba(0,29,61,0.12);border-radius:20px;box-shadow:0 28px 70px rgba(0,29,61,0.28);overflow:hidden;display:none;flex-direction:column;transform:translateY(14px);opacity:0;transition:transform .25s,opacity .25s;}'
    + '.dsw-panel.dsw-open{display:flex;transform:translateY(0);opacity:1;}'
    + '.dsw-head{display:flex;align-items:center;gap:11px;padding:13px 16px;background:#001D3D;border-bottom:1px solid rgba(197,148,62,0.3);}'
    + '.dsw-head img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid rgba(197,148,62,0.6);flex-shrink:0;}'
    + '.dsw-head .dsw-name{color:#fff;font-weight:700;font-size:15px;line-height:1.1;font-family:Lato,sans-serif;}'
    + '.dsw-head .dsw-st{display:flex;align-items:center;gap:6px;}'
    + '.dsw-head .dsw-dot{width:8px;height:8px;border-radius:50%;background:#25D366;animation:dsw-blink 1.6s ease-in-out infinite;}'
    + '.dsw-head .dsw-online{color:#25D366;font-size:12px;font-weight:700;font-family:Lato,sans-serif;}'
    + '.dsw-close{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:22px;line-height:1;padding:4px 6px;}'
    + '.dsw-close:hover{color:#fff;}'
    + '.dsw-body{flex:1;overflow-y:auto;padding:16px;background:#F4F6F9;display:flex;flex-direction:column;gap:11px;font-family:Lato,sans-serif;}'
    + '.dsw-msg{display:flex;gap:8px;align-items:flex-end;max-width:90%;}'
    + '.dsw-msg-bot{align-self:flex-start;}'
    + '.dsw-msg-user{align-self:flex-end;flex-direction:row-reverse;}'
    + '.dsw-msg img{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;}'
    + '.dsw-bubble{padding:10px 13px;border-radius:15px;font-size:14px;line-height:1.5;}'
    + '.dsw-bubble-bot{background:#fff;color:#1f2937;border-bottom-left-radius:5px;box-shadow:0 2px 8px rgba(0,29,61,0.06);}'
    + '.dsw-bubble-user{background:#001D3D;color:#FAF9F6;border-bottom-right-radius:5px;}'
    + '.dsw-link{color:#A67A2E;font-weight:800;text-decoration:underline;}'
    + '.dsw-wabtn{display:inline-flex;align-items:center;gap:8px;margin-top:9px;background:#25D366;color:#fff;font-weight:800;font-size:13px;padding:8px 13px;border-radius:10px;text-decoration:none;}'
    + '.dsw-wabtn svg{width:16px;height:16px;}'
    + '.dsw-typing{display:inline-flex;gap:4px;padding:12px 13px;}'
    + '.dsw-typing span{width:7px;height:7px;border-radius:50%;background:#9aa6b2;animation:dsw-bounce 1.2s infinite ease-in-out;}'
    + '.dsw-typing span:nth-child(2){animation-delay:.18s;}.dsw-typing span:nth-child(3){animation-delay:.36s;}'
    + '@keyframes dsw-bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}'
    + '.dsw-chips{display:flex;flex-wrap:wrap;gap:7px;padding:11px 13px 0;font-family:Lato,sans-serif;}'
    + '.dsw-chip{background:rgba(197,148,62,0.1);border:1px solid rgba(197,148,62,0.4);color:#A67A2E;border-radius:100px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;}'
    + '.dsw-chip:hover{background:rgba(197,148,62,0.2);}'
    + '.dsw-input{display:flex;gap:8px;padding:11px 13px;border-top:1px solid rgba(0,29,61,0.08);background:#fff;}'
    + '.dsw-input input{flex:1;border:1.5px solid rgba(0,29,61,0.18);border-radius:12px;padding:11px 13px;font-size:14px;color:#001D3D;outline:none;font-family:Lato,sans-serif;}'
    + '.dsw-input input:focus{border-color:#C5943E;box-shadow:0 0 0 3px rgba(197,148,62,0.18);}'
    + '.dsw-sendbtn{width:44px;flex-shrink:0;border:none;border-radius:12px;background:#C5943E;color:#001D3D;cursor:pointer;display:flex;align-items:center;justify-content:center;}'
    + '.dsw-sendbtn:hover{background:#A67A2E;}.dsw-sendbtn svg{width:19px;height:19px;}';

  function normalize(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'dsw-fab-wrap';
    wrap.innerHTML =
      '<div class="dsw-panel" id="dswPanel" role="dialog" aria-label="Chat de Suporte">'
      + '<div class="dsw-head">'
      + '<img src="' + AVATAR + '" alt="Suporte">'
      + '<div><div class="dsw-name">Suporte</div><div class="dsw-st"><span class="dsw-dot"></span><span class="dsw-online">online</span></div></div>'
      + '<button class="dsw-close" id="dswClose" aria-label="Fechar">&times;</button>'
      + '</div>'
      + '<div class="dsw-body" id="dswBody"></div>'
      + '<div class="dsw-chips" id="dswChips"></div>'
      + '<form class="dsw-input" id="dswForm" autocomplete="off">'
      + '<input type="text" id="dswInput" placeholder="Escreva sua dúvida..." aria-label="Sua dúvida">'
      + '<button type="submit" class="dsw-sendbtn" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '</form>'
      + '</div>'
      + '<button class="dsw-fab dsw-fab-chat" id="dswToggle" aria-label="Abrir chat de Suporte"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-5a9 9 0 0 1 18 0v5a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg><span class="dsw-fab-badge"></span></button>'
      + '<a class="dsw-fab dsw-fab-wa" href="' + WA + '" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">' + WA_ICON + '</a>';
    document.body.appendChild(wrap);

    var panel = document.getElementById('dswPanel');
    var body = document.getElementById('dswBody');
    var chips = document.getElementById('dswChips');
    var form = document.getElementById('dswForm');
    var input = document.getElementById('dswInput');
    var started = false;

    function scrollDown() { body.scrollTop = body.scrollHeight; }

    function addUser(text) {
      var d = document.createElement('div');
      d.className = 'dsw-msg dsw-msg-user';
      d.innerHTML = '<div class="dsw-bubble dsw-bubble-user"></div>';
      d.querySelector('.dsw-bubble').textContent = text;
      body.appendChild(d); scrollDown();
    }
    function addBot(html, withWa) {
      var d = document.createElement('div');
      d.className = 'dsw-msg dsw-msg-bot';
      var inner = '<img src="' + AVATAR + '" alt="Suporte"><div class="dsw-bubble dsw-bubble-bot">' + html;
      if (withWa) inner += '<br><a class="dsw-wabtn" href="' + WA + '" target="_blank" rel="noopener">' + WA_ICON + 'Falar no WhatsApp</a>';
      inner += '</div>';
      d.innerHTML = inner;
      body.appendChild(d); scrollDown();
    }
    function showTyping() {
      var d = document.createElement('div');
      d.className = 'dsw-msg dsw-msg-bot'; d.id = 'dswTyping';
      d.innerHTML = '<img src="' + AVATAR + '" alt="Suporte"><div class="dsw-bubble dsw-bubble-bot"><span class="dsw-typing"><span></span><span></span><span></span></span></div>';
      body.appendChild(d); scrollDown();
    }
    function hideTyping() { var t = document.getElementById('dswTyping'); if (t) t.remove(); }

    // 1) Tenta por palavra-chave (local, grátis, instantâneo)
    function findAnswerLocal(text) {
      var t = normalize(text), best = null, bestScore = 0;
      FAQ.forEach(function (item) {
        var score = 0;
        item.keys.forEach(function (k) { if (t.indexOf(normalize(k)) !== -1) score += normalize(k).split(' ').length; });
        if (score > bestScore) { bestScore = score; best = item; }
      });
      return bestScore > 0 ? best : null;
    }
    function findById(id) {
      for (var i = 0; i < FAQ.length; i++) { if (FAQ[i].id === id) return FAQ[i]; }
      return null;
    }
    // 2) Só quando a palavra-chave falha: IA (Gemini) apenas ENTENDE e roteia (não inventa)
    function aiRoute(text) {
      var topics = FAQ.map(function (f) { return { id: f.id, desc: f.desc }; });
      return fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, topics: topics })
      })
        .then(function (r) { return r.ok ? r.json() : { id: 'none' }; })
        .then(function (d) { return (d && d.id) ? d.id : 'none'; })
        .catch(function () { return 'none'; });
    }
    function respond(text) {
      showTyping();
      var local = findAnswerLocal(text);
      if (local) {
        setTimeout(function () { hideTyping(); addBot(local.a, !!local.wa); }, 600 + Math.random() * 450);
        return;
      }
      aiRoute(text).then(function (id) {
        hideTyping();
        var item = findById(id);
        if (item) addBot(item.a, !!item.wa);
        else addBot(FALLBACK, true);
      });
    }
    function send(text) {
      var c = (text || '').trim(); if (!c) return;
      addUser(c); respond(c);
    }

    FAQ.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dsw-chip'; b.textContent = item.chip;
      b.addEventListener('click', function () { send(item.chip); });
      chips.appendChild(b);
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); input.value = ''; });

    function openPanel() {
      panel.classList.add('dsw-open');
      if (!started) {
        started = true;
        setTimeout(function () { addBot('Olá! 👋 Eu sou a assistente de <strong>Suporte</strong> da Dra. Deliane Santos. Posso ajudar com dúvidas sobre a assessoria, o Café com a Lei e inscrições.<br><br>Escolha um assunto abaixo ou escreva sua pergunta. 💬'); }, 250);
      }
      setTimeout(function () { input.focus(); }, 300);
    }
    function closePanel() { panel.classList.remove('dsw-open'); }

    document.getElementById('dswToggle').addEventListener('click', function () {
      panel.classList.contains('dsw-open') ? closePanel() : openPanel();
    });
    document.getElementById('dswClose').addEventListener('click', closePanel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
