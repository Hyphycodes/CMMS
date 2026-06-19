/**
 * F4 CSV source — `parse` only; everything downstream is the shared pipeline.
 * Minimal RFC-4180-ish parser (quoted fields, escaped quotes, CRLF).
 */
import type { RawRow } from "../pipeline";

export function parseCsv(text: string): { headers: string[]; rows: RawRow[] } {
  const records = splitRecords(text.trim());
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0];
  const rows: RawRow[] = records.slice(1).map((cells) => {
    const row: RawRow = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
  return { headers, rows };
}

function splitRecords(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}
