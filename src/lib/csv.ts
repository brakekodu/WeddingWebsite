/**
 * Minimal RFC 4180 CSV writer. Cells that a spreadsheet would treat as a
 * formula (=, +, -, @, tab, CR) are prefixed with an apostrophe to prevent
 * CSV injection, since guests control some fields (e.g. dietary notes).
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
