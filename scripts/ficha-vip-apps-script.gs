/**
 * Google Apps Script — Planilha privada da Ficha Cadastral Grupo VIP
 *
 * ══════════════════════════════════════════════════════════════════
 * SOBRE O SECRET (token de segurança)
 * ══════════════════════════════════════════════════════════════════
 * NÃO vem do Excel nem do Google. Você mesmo INVENTA uma senha longa.
 *
 * Exemplo de token (não use este — crie o seu):
 *   ficha-vip-deliane-2026-xK9mP2qR7
 *
 * Passos:
 * 1. Escolha um texto aleatório longo (pode gerar em https://random.org/strings)
 * 2. Cole o MESMO texto em dois lugares:
 *    a) Na linha SECRET abaixo (neste script)
 *    b) No Vercel → Settings → Environment Variables → FICHA_VIP_SECRET
 * ══════════════════════════════════════════════════════════════════
 *
 * Configuração completa:
 * 1. Crie uma planilha no Google Drive (ex.: "Ficha VIP — Deliane Santos")
 * 2. Extensões → Apps Script → cole este código
 * 3. Preencha SECRET com o token que você criou
 * 4. Implantar → Nova implantação → Tipo: App da Web
 *    - Executar como: Eu
 *    - Quem tem acesso: Qualquer pessoa
 * 5. Copie a URL do Web App → Vercel → FICHA_VIP_WEBHOOK_URL
 *
 * Exportar para Excel: na planilha, Arquivo → Fazer download → Microsoft Excel (.xlsx)
 * Somente quem tem acesso à planilha no Drive vê os dados.
 */

// ↓↓↓ COLE AQUI o token que VOCÊ inventou (não é do Excel) ↓↓↓
const SECRET = 'COLE_SEU_TOKEN_AQUI';
const SHEET_NAME = 'Cadastros';

const HEADERS = [
  'Data/Hora',
  'Nome da Instituição',
  'CNPJ',
  'Responsável Legal',
  'Cargo/Função',
  'Cidade/Estado',
  'E-mail',
  'WhatsApp',
  'Interesse',
  'Principal Demanda',
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (SECRET && payload.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'forbidden' }, 403);
    }

    const sheet = getSheet_();
    sheet.appendRow([
      payload.dataHora || new Date().toISOString(),
      payload.nomeInstituicao || '',
      payload.cnpj || '',
      payload.responsavel || '',
      payload.cargo || '',
      payload.cidadeEstado || '',
      payload.email || '',
      payload.whatsapp || '',
      payload.interesse || '',
      payload.demanda || '',
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj, code) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
