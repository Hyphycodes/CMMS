/**
 * Re-runnable Supabase seed. Generates the deterministic world and upserts it
 * into the schema from supabase/migrations/0001_init.sql.
 *
 *   1. Apply the migration to your Supabase project.
 *   2. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (in .env.local or the shell).
 *   3. npm run seed:supabase
 *
 * Uses the service-role key (server-side only — never shipped to the browser).
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateWorld, DEFAULT_SEED_CONFIG } from "../src/data/seed/generate";

// minimal .env.local loader (no dependency)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or the shell.",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function upsert<T>(table: string, rows: T[], conflict: string) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await db.from(table).upsert(slice as object[], { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("Generating world…");
  const world = generateWorld(DEFAULT_SEED_CONFIG);

  const contractRows = world.contracts.map((c) => ({
    id: c.id,
    number: c.number,
    name: c.name,
    county: c.county,
    district: c.district,
    work_type: c.workType,
    inventory_count: c.inventoryCount,
    ready_for_review_count: c.readyForReviewCount,
    summary: c.summary,
  }));

  const payItemRows = [...world.payItemsByContract.entries()].flatMap(([contractId, items]) =>
    items.map((p) => ({
      contract_id: contractId,
      number: p.number,
      description: p.description,
      unit: p.unit,
      unit_price: p.unitPrice,
      awarded_quantity: p.awardedQuantity,
      placed_quantity: p.placedQuantity,
    })),
  );

  const itemRows = world.items.map((i) => ({
    id: i.id,
    inventory_id: i.inventoryId,
    contract_id: i.contractId,
    contract_number: i.contractNumber,
    material_code: i.materialCode,
    material_name: i.materialName,
    material_unit: i.materialUnit,
    producer_number: i.producerNumber,
    producer_name: i.producerName,
    supplier_number: i.supplierNumber,
    supplier_name: i.supplierName,
    status: i.status,
    note: i.note,
    pay_item_numbers: i.payItemNumbers,
    ready_at: i.readyAt ? new Date(i.readyAt).toISOString() : null,
  }));

  console.log(`Seeding ${contractRows.length} contracts, ${payItemRows.length} pay items, ${itemRows.length} inventory items…`);
  await upsert("contracts", contractRows, "id");
  await upsert("pay_items", payItemRows, "contract_id,number");
  await upsert("inventory_items", itemRows, "id");
  console.log("✓ Seed complete.");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
