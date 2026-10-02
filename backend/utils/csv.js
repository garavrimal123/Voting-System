// Builds a CSV string that opens correctly in Excel/Sheets.
//
// Formula-injection protection: a cell whose text starts with = + - @ (or a
// tab / carriage return) can be executed as a formula when the file is opened
// in a spreadsheet. Voter names and other fields are user-supplied, so any
// such cell is prefixed with an apostrophe to force it to be treated as text.
function csvCell(value) {
  if (value === undefined || value === null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  // BOM so Excel reads Nepali (Devanagari) text as UTF-8.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

module.exports = { toCsv };
