const FORMULA_PREFIX_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function escapeCsvCell(raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);

  // Guard against spreadsheet formula injection
  if (str.length > 0 && FORMULA_PREFIX_CHARS.has(str[0]!)) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
