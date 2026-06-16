/**
 * Google Apps Script — Planilha privada da Ficha Cadastral Grupo VIP
 *
 * A cada cadastro grava:
 *   1. Linha na aba "Cadastros"
 *   2. Entrada em ficha-vip-backup.md (na mesma pasta do Drive da planilha)
 *
 * Variáveis no Vercel: FICHA_VIP_WEBHOOK_URL, FICHA_VIP_SECRET (mesmo SECRET abaixo)
 */

// ↓↓↓ COLE AQUI o token que VOCÊ inventou (não é do Excel) ↓↓↓
const SECRET = 'COLE_SEU_TOKEN_AQUI';
const SHEET_NAME = 'Cadastros';
const BACKUP_MD_NAME = 'ficha-vip-backup.md';

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

const BACKUP_HEADER =
  '# Ficha Cadastral — Grupo VIP (backup)\n\n' +
  'Arquivo gerado automaticamente a cada cadastro no site.\n' +
  'Cadastros mais recentes aparecem primeiro.\n\n' +
  '---\n\n';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (SECRET && SECRET !== 'COLE_SEU_TOKEN_AQUI' && payload.secret !== SECRET) {
      return jsonResponse({ ok: false, error: 'forbidden' });
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

    appendMarkdownBackup_(payload);

    return jsonResponse({ ok: true });
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
  if (p.demanda) {
    lines.push('- **Demanda:** ' + p.demanda);
  }
  lines.push('');
  return lines.join('\n') + '---\n\n';
}

function appendMarkdownBackup_(payload) {
  const entry = formatMarkdownEntry_(payload);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
