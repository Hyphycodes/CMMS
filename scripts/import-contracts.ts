/**
 * Validated, dry-runnable import of real contracts + pay items (brief 12).
 * Flips Proof from demo to system of record. Expects dirty data: every row is
 * validated and a per-row error report is printed. Nothing is written unless you
 * pass --commit.
 *
 *   npm run import -- contracts.csv                 # dry run (default)
 *   npm run import -- contracts.csv --commit        # write to Supabase
 *
 * CSV columns (header row required):
 *   contracts:  id,number,name,county,district,work_type
 *   pay items:  contract_id,number,description,unit,unit_price,awarded_quantity
 * Pass --kind=contracts (default) or --kind=pay_items.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const commit = args.includes("--commit");
const kind = (args.find((a) => a.startsWith("--kind="))?.split("=")[1] ?? "contracts") as "contracts" | "pay_items";

if (!file || !existsSync(file)) {
  console.error("Usage: npm run import -- <file.csv> [--commit] [--kind=contracts|pay_items]");
  process.exit(1);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (cells[i] ?? "").trim()));
    return row;
  });
}
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

interface RowError {
  line: number;
  errors: string[];
}

const CONTRACT_FIELDS = ["id", "number", "name", "county", "district", "work_type"];
const PAY_ITEM_FIELDS = ["contract_id", "number", "description", "unit", "unit_price", "awarded_quantity"];

function validate(rows: Record<string, string>[]): { ok: Record<string, unknown>[]; bad: RowError[] } {
  const ok: Record<string, unknown>[] = [];
  const bad: RowError[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2; // 1-based + header
    const errors: string[] = [];
    const required = kind === "contracts" ? CONTRACT_FIELDS : PAY_ITEM_FIELDS;
    for (const f of required) if (!r[f]) errors.push(`missing ${f}`);

    if (kind === "contracts") {
      if (r.district && Number.isNaN(Number(r.district))) errors.push(`district not numeric: "${r.district}"`);
      const key = r.id || r.number;
      if (key && seen.has(key)) errors.push(`duplicate contract ${key}`);
      seen.add(key);
    } else {
      for (const f of ["unit_price", "awarded_quantity"]) {
        if (r[f] && Number.isNaN(Number(r[f]))) errors.push(`${f} not numeric: "${r[f]}"`);
      }
      const key = `${r.contract_id}:${r.number}`;
      if (seen.has(key)) errors.push(`duplicate pay item ${key}`);
      seen.add(key);
    }

    if (errors.length) {
      bad.push({ line, errors });
    } else if (kind === "contracts") {
      ok.push({
        id: r.id,
        number: r.number,
        name: r.name,
        county: r.county,
        district: Number(r.district),
        work_type: r.work_type,
        summary: {},
      });
    } else {
      ok.push({
        contract_id: r.contract_id,
        number: r.number,
        description: r.description,
        unit: r.unit,
        unit_price: Number(r.unit_price),
        awarded_quantity: Number(r.awarded_quantity),
        placed_quantity: 0,
      });
    }
  });
  return { ok, bad };
}

async function main() {
  const rows = parseCsv(readFileSync(file!, "utf8"));
  const { ok, bad } = validate(rows);

  console.log(`\nImport — ${kind} — ${file}`);
  console.log(`  parsed:  ${rows.length}`);
  console.log(`  valid:   ${ok.length}`);
  console.log(`  errors:  ${bad.length}`);
  if (bad.length) {
    console.log("\nError report (first 50):");
    for (const e of bad.slice(0, 50)) console.log(`  line ${e.line}: ${e.errors.join("; ")}`);
  }

  if (!commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to write the valid rows.\n");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for --commit.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const conflict = kind === "contracts" ? "id" : "contract_id,number";
  const { error } = await db.from(kind).upsert(ok as object[], { onConflict: conflict });
  if (error) {
    console.error("Write failed:", error.message);
    process.exit(1);
  }
  console.log(`\n✓ Wrote ${ok.length} ${kind} rows (${bad.length} skipped).\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
