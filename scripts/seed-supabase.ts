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
      fund_key: p.fundKey ?? null,
      final: p.final ?? false,
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

  // Module tables (briefs 03–11). Requires 0002_modules.sql applied.
  const sampleRows = world.samples.map((s) => ({
    id: s.id, sample_identifier: s.sampleIdentifier, test_id: s.testId, inspection_type: s.inspectionType, inspector: s.inspector,
    sample_date: s.sampleDate, total_samples: s.totalSamples, material_code: s.materialCode, material_name: s.materialName,
    desc1: s.desc1, desc2: s.desc2, desc3: s.desc3, special_id: s.specialId, inspected_qty: s.inspectedQty, material_unit: s.materialUnit,
    producer_number: s.producerNumber, producer_name: s.producerName, supplier_number: s.supplierNumber, supplier_name: s.supplierName,
    sampled_from: s.sampledFrom, latitude: s.latitude, longitude: s.longitude, spec_year: s.specYear, dsa_baba: s.dsaBaba,
    responsible_lab: s.responsibleLab, contract_id: s.contractId, pay_item_number: s.payItemNumber, inventory_item_id: s.inventoryItemId,
    received_date: s.receivedDate, started_date: s.startedDate, completed_date: s.completedDate, status: s.status,
    approver_name: s.approverName, approved_date: s.approvedDate, note: s.note, has_document: s.hasDocument,
  }));
  const testRows = world.tests.map((t) => ({
    id: t.id, sample_id: t.sampleId, series: t.series, test_type: t.testType, tested_by: t.testedBy, test_date: t.testDate,
    fields: t.fields, validated: t.validated, validated_by: t.validatedBy, validated_at: t.validatedAt,
  }));
  const placementRows = world.placements.map((p) => ({
    id: p.id, contract_id: p.contractId, pay_item_number: p.payItemNumber, date: p.date, fund_key: p.fundKey, type: p.type,
    quantity: p.quantity, price: p.price, location: p.location, contractor: p.contractor, posted: p.posted, pay_estimate_id: p.payEstimateId, creator: p.creator,
  }));
  const estimateRows = world.payEstimates.map((e) => ({
    id: e.id, contract_id: e.contractId, number: e.number, period_start: e.periodStart, period_end: e.periodEnd, status: e.status,
    submitted_by: e.submittedBy, submitted_at: e.submittedAt, lines: e.lines, this_estimate_total: e.thisEstimateTotal, to_date_total: e.toDateTotal,
  }));
  const authRows = world.authorizations.map((a) => ({
    id: a.id, contract_id: a.contractId, number: a.number, type: a.type, description: a.description, net_change: a.netChange,
    status: a.status, created_date: a.createdDate, items: a.items, approvals: a.approvals, has_attachment: a.hasAttachment,
  }));
  const mixRows = world.mixDesigns.map((m) => ({
    number: m.number, material_code: m.materialCode, family: m.family, producer: m.producer, approved: m.approved, doc_url: m.docUrl ?? null,
  }));
  const suspensionRows = [...world.suspensionsByContract.values()].flat().map((s) => ({
    contract_id: s.contractId, from_date: s.from, to_date: s.to, reason: s.reason,
  }));

  console.log(`Seeding ${contractRows.length} contracts, ${payItemRows.length} pay items, ${itemRows.length} inventory items…`);
  await upsert("contracts", contractRows, "id");
  await upsert("pay_items", payItemRows, "contract_id,number");
  await upsert("inventory_items", itemRows, "id");
  console.log(`Seeding ${sampleRows.length} samples, ${testRows.length} tests, ${placementRows.length} placements, ${estimateRows.length} estimates, ${authRows.length} authorizations…`);
  await upsert("samples", sampleRows, "id");
  await upsert("tests", testRows, "id");
  await upsert("placements", placementRows, "id");
  await upsert("pay_estimates", estimateRows, "id");
  await upsert("authorizations", authRows, "id");
  await upsert("mix_designs", mixRows, "number");
  if (suspensionRows.length) {
    const { error } = await db.from("diary_suspensions").insert(suspensionRows);
    if (error) console.warn("diary_suspensions:", error.message);
  }
  console.log("✓ Seed complete.");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
