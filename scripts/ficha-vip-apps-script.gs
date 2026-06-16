/**
 * Google Apps Script — Planilha privada
 *
 * Recebe dados de:
 * 1) Ficha VIP  -> aba "Cadastros" + backup markdown no Drive
 * 2) Escola Legal -> aba "Escola-Legal" (sem backup markdown)
 */

// ↓↓↓ COLE AQUI o token que VOCÊ inventou (o mesmo do Vercel) ↓↓↓
const SECRET = 'COLE_SEU_TOKEN_AQUI';

// ID da planilha (da URL: .../spreadsheets/d/ESTE_ID/edit). Deixe '' se o script
// foi criado em Extensões → Apps Script DENTRO da planilha.
const SPREADSHEET_ID = '';

const SHEET_NAME_VIP = 'Cadastros';
const VIP_SHEET_CANDIDATES = ['Contatos', 'Cadastros'];
const SHEET_NAME_ESCOLA_LEGAL = 'Escola-Legal';
const BACKUP_MD_NAME = 'ficha-vip-backup.md';

const HEADERS_VIP = [
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

const HEADERS_ESCOLA_LEGAL = [
  'Data/Hora',
  'Origem',
  'Nome da Instituição',
  'CNPJ',
  'Responsável',
  'CPF',
  'E-mail',
  'WhatsApp',
  'Endereço',
  'Valor Mensal',
  'Contrato por E-mail',
  'Cópia Escritório',
];

const BACKUP_HEADER =
  '# Ficha Cadastral — Grupo VIP (backup)\n\n' +
  'Arquivo gerado automaticamente a cada cadastro no site.\n' +
  'Cadastros mais recentes aparecem primeiro.\n\n' +
  '---\n\n';

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (p.probe === 'secret') {
    if (SECRET && SECRET !== 'COLE_SEU_TOKEN_AQUI' && p.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'forbidden' });
    }
    return jsonResponse({ ok: true, probe: 'secret_ok' });
  }
  var spreadsheetName = null;
  var spreadsheetLinked = false;
  try {
    spreadsheetName = getSpreadsheet_().getName();
    spreadsheetLinked = true;
  } catch (ignore) {}
  return jsonResponse({
    ok: true,
    service: 'ficha-vip',
    sheets: VIP_SHEET_CANDIDATES.concat([SHEET_NAME_ESCOLA_LEGAL]),
    spreadsheet: spreadsheetName,
    spreadsheetLinked: spreadsheetLinked,
    secretRequired: SECRET && SECRET !== 'COLE_SEU_TOKEN_AQUI',
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (SECRET && SECRET !== 'COLE_SEU_TOKEN_AQUI' && payload.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'forbidden' });
    }

    if (payload.probe === 'secret') {
      return jsonResponse({ ok: true, probe: 'secret_ok' });
    }

    if (payload.origem === 'escola-legal') {
      const escolaSheet = getOrCreateSheet_(SHEET_NAME_ESCOLA_LEGAL, HEADERS_ESCOLA_LEGAL);
      escolaSheet.appendRow([
        payload.dataHora || new Date().toISOString(),
        payload.origem || 'escola-legal',
        payload.nomeInstituicao || '',
        payload.cnpj || '',
        payload.responsavel || '',
        payload.cpf || '',
        payload.email || '',
        payload.whatsapp || '',
        payload.endereco || '',
        payload.valorMensal || 'R$ 1.740,00',
        payload.emailContratoEnviado || '',
        payload.copiaEscritorioEnviada || '',
      ]);
      return jsonResponse({ ok: true, sheet: SHEET_NAME_ESCOLA_LEGAL });
    }

    const vipSheet = getVipSheet_();
    vipSheet.appendRow([
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

    try {
      appendMarkdownBackup_(payload);
    } catch (backupErr) {
      // Não falha o cadastro se o backup .md no Drive der erro.
    }

    const ss = getSpreadsheet_();
    return jsonResponse({
      ok: true,
      sheet: vipSheet.getName(),
      spreadsheet: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function formatMarkdownEntry_(p) {
  const dt = p.dataHora || new Date().toISOString();
  const lines = [
    '## ' + dt,
    '',
    '- **Instituição:** ' + (p.nomeInstituicao || ''),
    '- **CNPJ:** ' + (p.cnpj || ''),
    '- **Responsável:** ' + (p.responsavel || ''),
    '- **Cargo:** ' + (p.cargo || ''),
    '- **Cidade/Estado:** ' + (p.cidadeEstado || ''),
    '- **E-mail:** ' + (p.email || ''),
    '- **WhatsApp:** ' + (p.whatsapp || ''),
    '- **Interesse:** ' + (p.interesse || ''),
  ];
  if (p.demanda) lines.push('- **Demanda:** ' + p.demanda);
  lines.push('');
  return lines.join('\n') + '---\n\n';
}

function appendMarkdownBackup_(payload) {
  const entry = formatMarkdownEntry_(payload);
  const ss = getSpreadsheet_();
  const ssFile = DriveApp.getFileById(ss.getId());
  const folders = ssFile.getParents();
  const folder = folders.hasNext() ? folders.next() : DriveApp.getRootFolder();

  const files = folder.getFilesByName(BACKUP_MD_NAME);
  if (files.hasNext()) {
    const file = files.next();
    const content = file.getBlob().getDataAsString('UTF-8');
    const marker = '---\n\n';
    const headerEnd = content.indexOf(marker);

    if (headerEnd === -1) {
      file.setContent(BACKUP_HEADER + entry + content);
    } else {
      const header = content.slice(0, headerEnd + marker.length);
      const rest = content.slice(headerEnd + marker.length);
      file.setContent(header + entry + rest);
    }
  } else {
    folder.createFile(BACKUP_MD_NAME, BACKUP_HEADER + entry, MimeType.PLAIN_TEXT);
  }
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'Planilha nao vinculada. Abra a planilha → Extensões → Apps Script e cole o codigo la, ' +
      'OU defina SPREADSHEET_ID com o ID da URL da planilha.'
    );
  }
  return ss;
}

function getVipSheet_() {
  const ss = getSpreadsheet_();
  for (var i = 0; i < VIP_SHEET_CANDIDATES.length; i++) {
    var existing = ss.getSheetByName(VIP_SHEET_CANDIDATES[i]);
    if (existing) return existing;
  }
  return getOrCreateSheet_(SHEET_NAME_VIP, HEADERS_VIP);
}

function getOrCreateSheet_(sheetName, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/** Rode esta funcao no editor (Executar) uma vez para autorizar e testar a planilha. */
function testGravarLinha() {
  var ss = getSpreadsheet_();
  var sheet = getVipSheet_();
  sheet.appendRow([
    new Date().toISOString(),
    'TESTE MANUAL — pode apagar',
    '', '', '', '', '', '', '', '',
  ]);
  Logger.log('OK — gravado na planilha «' + ss.getName() + '», aba «' + sheet.getName() + '»');
}

