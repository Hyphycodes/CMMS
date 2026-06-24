/**
 * Inventory fill — when an inventory is being *completed*, its Quantity Ledger
 * and Evidence of Inspection should fill up to the quantity the contract budget
 * allows for it, in the correct material unit. "How much the budget allows" is
 * driven off the linked pay items: a pay item that has placed `P` units of work
 * needs `P × conversionFactor` units of this material (the same grouping math the
 * Pay Item Materials tab uses). Filling to that target lands the balance at ~0
 * (Satisfactory) instead of leaving the record visibly short.
 *
 * Pure module — data in, result out, no store imports — so the seed, the live
 * "Fill to budget" action, and the closeout side can all reuse it.
 */
import type { EOIEntry, InventoryItem, LedgerEntry, Material, PayItem } from "@/domain/types";
import { makeRng } from "@/data/seed/rng";

const MS_DAY = 86_400_000;

export interface FillResult {
  ledger: LedgerEntry[];
  eoi: EOIEntry[];
  /** total received material the fill targets, in the material unit */
  targetQty: number;
}

export interface FillOptions {
  /** real, matching Test IDs to distribute across the EOI rows (certs-only when empty) */
  testIds?: string[];
  /** when true the generated EOI rows are pre-Approved (used for completed/seed inventory) */
  approve?: boolean;
  /** epoch ms the deliveries center on (defaults to item.readyAt or "now"-ish) */
  baseEpoch?: number;
  /** stable now for date math (kept out so the module has no Date.now ambient dep at call-defining time) */
  now?: number;
}

/**
 * The material quantity the linked pay items' budget supports, in material units.
 * Uses placed quantity when work has been placed, else the awarded quantity — so
 * even brand-new pay items (61D34's placed=0 plan) still produce a sensible target.
 */
export function computeFillTarget(item: InventoryItem, payItems: PayItem[], conversionFactor: number): number {
  let total = 0;
  for (const num of item.payItemNumbers) {
    const pi = payItems.find((p) => p.number === num);
    if (!pi) continue;
    const payQty = pi.placedQuantity > 0 ? pi.placedQuantity : pi.awardedQuantity;
    total += payQty * conversionFactor;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Build a filled ledger + EOI for an inventory item up to its budget target.
 * Deterministic per item id, so a re-run/re-load is byte-identical.
 */
export function buildFill(
  item: InventoryItem,
  payItems: PayItem[],
  material: Material | undefined,
  opts: FillOptions = {},
): FillResult {
  const rng = makeRng(`fill:${item.id}`);
  const conversionFactor = material?.conversionFactor ?? 1;
  const targetQty = computeFillTarget(item, payItems, conversionFactor);

  // Spread the target across 1–3 delivery rows so it reads like real deliveries.
  const rowCount = targetQty <= 0 ? 1 : rng.int(1, 3);
  const base = opts.baseEpoch ?? item.readyAt ?? (opts.now ?? 0) - 30 * MS_DAY;
  const payItemNumber = item.payItemNumbers[0] ?? "";
  const isHMA = material?.family === "HMA";
  const isSteel = material?.family === "Steel";

  const ledger: LedgerEntry[] = [];
  let remaining = targetQty;
  for (let i = 0; i < rowCount; i++) {
    const last = i === rowCount - 1;
    const qty = last ? remaining : Math.round((remaining / (rowCount - i)) * rng.float(0.7, 1.15) * 100) / 100;
    remaining = Math.round((remaining - qty) * 100) / 100;
    ledger.push({
      id: i + 1,
      date: isoDate(base + i * rng.int(2, 9) * MS_DAY),
      payItemNumber,
      desc1: isSteel ? rng.pick(["4", "5", "6", "8"]) : "",
      desc2: isSteel ? rng.pick(["3453-14", "2394-10", "6024-04"]) : "",
      desc3: "",
      mixDesign: isHMA ? `80BIT${rng.int(1000, 9999)}` : "",
      batchLotHeat: rng.bool(0.7) ? `L${rng.int(19000000, 21999999)}` : "",
      type: "Received",
      transactionQty: Math.max(0, qty),
    });
  }

  // One EOI row per ledger line. Actual EOI / MOA pull from the material's own
  // acceptable codes so "Actual" lines up with "Required" out of the box.
  const acceptableEoi = material?.acceptableEoi?.length ? material.acceptableEoi : ["CERT"];
  const moaCodes = moaFrom(material?.moa);
  const testIds = opts.testIds ?? [];

  const eoi: EOIEntry[] = ledger.map((l, i) => ({
    id: `${item.id}_eoi_${i + 1}`,
    ledgerIds: [l.id],
    actualEoi: acceptableEoi.slice(0, Math.min(acceptableEoi.length, 2)),
    actualMoa: moaCodes,
    testId: testIds.length ? testIds[i % testIds.length] : "",
    approval: opts.approve ? "Approved" : "Unset",
    note: "",
    hasDocument: opts.approve ? true : rng.bool(0.4),
  }));

  return { ledger, eoi, targetQty };
}

/** Split a material's MOA string ("TEST / CERT") into the discrete MOA codes. */
function moaFrom(moa: string | undefined): string[] {
  if (!moa) return ["CERT"];
  const codes = moa
    .toUpperCase()
    .split(/[^A-Z]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return codes.length ? [...new Set(codes)] : ["CERT"];
}

function isoDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}
