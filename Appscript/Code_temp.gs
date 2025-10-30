/**
 * ====== CONFIG ======
 * Replace with your Spreadsheet ID.
 */
const SPREADSHEET_ID = '1fQTTbwhox4sTLXLAImD9945cIU4E1IEXq4P6s8yrC_8';

/**
 * ====== Helpers ======
 */
function _ss() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error(`Unable to open spreadsheet with ID ${SPREADSHEET_ID}: ${err && err.message ? err.message : err}`);
  }
}

function _getSheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function _headers(sh) {
  const range = sh.getRange(1,1,1,sh.getLastColumn() || 1);
  const values = range.getValues()[0];
  return values.map(v => String(v||'').trim());
}

function _ensureHeaders(sh, cols) {
  const h = _headers(sh);
  if (h.filter(Boolean).length === 0) {
    sh.getRange(1,1,1,cols.length).setValues([cols]);
  }
}