/**
 * Sanity-check the deterministic seed: counts, the Ready-for-Review backlog,
 * duplicate clusters, and that detail builds. Run: `npx tsx scripts/check-seed.ts`.
 */
import { generateWorld, buildDetail, DEFAULT_SEED_CONFIG } from "../src/data/seed/generate";

const world = generateWorld(DEFAULT_SEED_CONFIG);

const ready = world.items.filter((i) => i.status === "Ready for Review");
const needs = world.items.filter((i) => i.status === "Needs Attention");
const complete = world.items.filter((i) => i.status === "Review Complete");

// duplicate clusters: same contract + material + producer + supplier, count > 1
const keys = new Map<string, number>();
for (const it of world.items) {
  const k = `${it.contractId}|${it.materialCode}|${it.producerNumber}|${it.supplierNumber}`;
  keys.set(k, (keys.get(k) ?? 0) + 1);
}
const dupeClusters = [...keys.values()].filter((n) => n > 1).length;
const readyDupeKeys = new Map<string, number>();
for (const it of ready) {
  const k = `${it.contractId}|${it.materialCode}|${it.producerNumber}|${it.supplierNumber}`;
  readyDupeKeys.set(k, (readyDupeKeys.get(k) ?? 0) + 1);
}
const readyDupes = [...readyDupeKeys.values()].filter((n) => n > 1).length;

// detail builds for a sample item
const sample = ready[0];
const detail = buildDetail(sample, world.payItemsByContract.get(sample.contractId) ?? []);

// re-run determinism: same counts on a second generation
const world2 = generateWorld(DEFAULT_SEED_CONFIG);

console.log("Contracts:            ", world.contracts.length);
console.log("Inventory items:      ", world.items.length);
console.log("  Needs Attention:    ", needs.length);
console.log("  Ready for Review:   ", ready.length);
console.log("  Review Complete:    ", complete.length);
console.log("Pay items (total):    ", [...world.payItemsByContract.values()].reduce((s, a) => s + a.length, 0));
console.log("Duplicate clusters:   ", dupeClusters, "(in Ready-for-Review:", readyDupes + ")");
console.log("Sample detail tabs:   ", `ledger=${detail.ledger.length} eoi=${detail.eoi.length} payItemMaterials=${detail.payItemMaterials.length}`);
console.log("Deterministic re-run:  items match =", world.items.length === world2.items.length);

const ok =
  world.contracts.length === 200 &&
  world.items.length >= 7000 &&
  ready.length >= 1000 &&
  readyDupes > 0 &&
  detail.ledger.length > 0;
console.log(ok ? "\n✓ Seed checks passed" : "\n✗ Seed checks FAILED");
process.exit(ok ? 0 : 1);
