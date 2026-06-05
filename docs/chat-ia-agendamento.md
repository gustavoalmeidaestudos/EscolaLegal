# Ideia (registro) — Chat com IA + Agendamento

> Status: **NÃO IMPLEMENTADO** — documento apenas para registro/planejamento futuro.
> Data do registro: 2026-06-05

## Visão geral
Adicionar ao site um **botão flutuante de "Chat com IA"** (empilhado junto ao botão flutuante do WhatsApp) que funcione como uma **assistente virtual humanizada** da Dra. Deliane Santos, com dois objetivos:

1. **Tirar dúvidas iniciais** dos visitantes.
2. **Agendar reuniões no Google Meet** vinculadas à agenda do Google da doutora.

---

## Requisitos funcionais (conforme solicitado)

### 1. Assistente virtual (atendimento)
- Tom **humanizado**, como uma assistente virtual de atendimento.
- Responde **somente** com base em **documentos/textos pré-licenciados pela doutora** (uma pasta com PDFs).
- **Não inventa** informação. Quando não souber a resposta, exibe um botão: **"Falar no WhatsApp"**.

### 2. Agendamento de reuniões (Google Meet + Google Calendar)
- Vinculado **diretamente à agenda do Google da doutora**.
- Aba de **calendário no chat**: mostra "quadradinhos" dos dias, indicando **livres** e **ocupados**, conforme a disponibilidade real.
- Ao **clicar em um dia**, mostra os **horários disponíveis** daquele dia.
- Ao clicar para **marcar**, abre um **pop-up no chat com um formulário**:
  - Nome Completo
  - Instituição de Ensino
  - Cargo
  - Segmento da Escola
  - Cidade/UF
  - Número aproximado de colaboradores
  - **Qual o assunto** → vira o **título da reunião no Meet**; se houver erros de escrita, o título é **corrigido** automaticamente.
  - Botão **"Enviar"**.
- Ao **enviar**:
  - Aparece no chat uma **mensagem de confirmação** com: **título da reunião, data e hora**.
  - Cria o agendamento **na agenda da doutora** e **na agenda do Google da pessoa** que marcou (via convite/attendee).
  - Gera **link do Google Meet**.
  - Informa um **Protocolo de Agendamento**.
- **Cancelamento**: a pessoa informa o **Protocolo de Agendamento** e clica em **"Confirmar cancelamento"** para cancelar o evento.

---

## Viabilidade técnica (resumo)

- **Possível?** Sim.
- **Gratuito?** Em grande parte sim, em **volume baixo**, escolhendo os serviços certos (ver abaixo). Pode virar custo (geralmente baixo) em volume alto.
- **Onde fica a chave de API?** **NUNCA no frontend.** Vai em **Environment Variables do Vercel**
  (Project → Settings → Environment Variables) e é lida apenas pelo código de servidor.

### Mudança de arquitetura
Hoje o site é **estático**. Esse recurso exige um **backend**, que pode ser hospedado no próprio Vercel via **Serverless Functions** (pasta `/api`) — continua no plano grátis (com limites de uso).

---

## Arquitetura proposta

### A) IA que responde só com base nos PDFs (RAG)
- **RAG (Retrieval-Augmented Generation)**: indexar os PDFs e responder apenas com o conteúdo deles.
- Guardrails anti-alucinação: se não houver base suficiente → fallback **"Falar no WhatsApp"**.
- Opções gratuitas/baratas:
  - LLM + embeddings: **Google Gemini** (camada gratuita) ou Groq (free tier).
  - Armazenamento de vetores: **Supabase (pgvector)** free, ou índice em arquivo para poucos documentos.

### B) Agendamento (Google Calendar API + Meet)
- **Google Calendar API** (gratuita):
  - **FreeBusy API** → disponibilidade (dias/horários livres x ocupados).
  - `events.insert` com `conferenceData` → cria evento + link do **Meet**.
  - `attendees` → adiciona a pessoa; ela recebe o convite e o evento entra na agenda dela ao aceitar.
- **Autenticação**: projeto no **Google Cloud**, autorização única da conta da doutora (OAuth → **refresh token** guardado como variável de ambiente no Vercel).
- **Protocolo + cancelamento**: armazenar `protocolo → eventId` em um banco gratuito (Supabase) ou planilha; cancelar via API por esse ID.
- **Correção do título**: passar o "assunto" pela IA para corrigir ortografia antes de salvar como título do evento.

### C) Frontend
- Dois botões flutuantes (Chat IA acima do WhatsApp).
- Janela de chat com: mensagens, calendário interativo, pop-up de formulário, telas de confirmação/cancelamento.

---

## Serviços e contas necessárias
- **Vercel** — hospedagem do site + Serverless Functions (já temos; plano grátis).
- **Google Cloud** — projeto + Google Calendar API habilitada + credenciais OAuth.
- **Provedor de IA** — Google Gemini (ou similar) para chat/embeddings.
- **(Opcional) Banco** — Supabase free (vetores dos PDFs e/ou protocolos de agendamento).

## Onde entra cada chave (todas como Environment Variables no Vercel)
- `GEMINI_API_KEY` (ou equivalente do provedor de IA)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` (agenda da doutora)
- `SUPABASE_URL`, `SUPABASE_KEY` (se usar Supabase)

---

## Riscos / pontos de atenção
- É um **mini-produto/software**, bem mais complexo que o site atual.
- Gratuito **em volume baixo**; volume alto pode gerar custos (normalmente baixos).
- Manutenção: trocar conta Google da doutora ou alterar os PDFs exige reautorizar/reindexar.
- Necessário cuidado com **privacidade/LGPD** dos dados coletados no agendamento.
- Validação de campos obrigatórios e tratamento de fusos/horários.

---

## Plano sugerido em fases
- **Fase 1 — Chat com IA (RAG nos PDFs)** + fallback "Falar no WhatsApp". (mais simples, alto valor)
- **Fase 2 — Agendamento** (disponibilidade, formulário, confirmação com protocolo, cancelamento, Meet).

---

*Documento de registro. Nenhuma alteração foi aplicada ao site.*
