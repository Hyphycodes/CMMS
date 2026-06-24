/**
 * Test ID usage — track when a Test ID's sample quantity runs out.
 *
 * Samples are logged in *with a quantity* (`inspectedQty`) — that's the Test ID's
 * capacity. Every Evidence-of-Inspection row that ties an inventory to a Test ID
 * consumes some of that capacity: the quantity a row represents is the sum of the
 * `transactionQty` of the ledger lines it links to. Consumed = Σ of those, across
 * every tied EOI row contract-wide. Remaining = capacity − consumed; the Test ID
 * is "used up" when remaining ≤ 0. Units line up because samples and inventory are
 * scoped by the same material.
 *
 * We never store a "used up" flag — it's always computed from live data, so it
 * can't drift. Pure module: data in, result out, no store imports — the dropdown
 * gray-out, the Test ID Usage page, and (later) closeout all reuse it.
 */
import type { Sample } from "@/domain/types";

/** One EOI row tied to a Test ID, already reduced to the quantity it represents. */
export interface TestIdDraw {
  testId: string;
  /** Σ transactionQty of the ledger lines this EOI row links to (material unit). */
  qty: number;
  inventoryItemId: string;
  inventoryDisplayId: string;
  contractId: string;
  contractNumber: string;
  materialCode: string;
}

export interface TestIdUsage {
  testId: string;
  /** the sample that issued this Test ID (capacity source); undefined ⇒ orphan tie */
  sample?: Sample;
  materialCode: string;
  materialName: string;
  unit: string;
  capacity: number;
  consumed: number;
  remaining: number;
  usedUp: boolean;
  /** 0..1 fraction consumed (clamped) for the progress bar */
  fraction: number;
  consumers: TestIdDraw[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the usage map keyed by Test ID. Every sample that carries a Test ID gets
 * a row (so capacity is visible even before anything draws it down); orphan draws
 * (a Test ID tied with no matching sample) also surface, with zero capacity.
 */
export function computeTestIdUsage(samples: Sample[], draws: TestIdDraw[]): Map<string, TestIdUsage> {
  const out = new Map<string, TestIdUsage>();

  const sampleByTestId = new Map<string, Sample>();
  for (const s of samples) {
    if (s.testId) sampleByTestId.set(s.testId, s);
  }

  const ensure = (testId: string, seed?: TestIdDraw): TestIdUsage => {
    const existing = out.get(testId);
    if (existing) return existing;
    const sample = sampleByTestId.get(testId);
    const capacity = sample?.inspectedQty ?? 0;
    const usage: TestIdUsage = {
      testId,
      sample,
      materialCode: sample?.materialCode ?? seed?.materialCode ?? "",
      materialName: sample?.materialName ?? "",
      unit: sample?.materialUnit ?? "",
      capacity,
      consumed: 0,
      remaining: capacity,
      usedUp: false,
      fraction: 0,
      consumers: [],
    };
    out.set(testId, usage);
    return usage;
  };

  // Seed a row for every sample-issued Test ID.
  for (const s of samples) if (s.testId) ensure(s.testId);

  // Fold in the draws.
  for (const d of draws) {
    if (!d.testId) continue;
    const u = ensure(d.testId, d);
    u.consumed = round2(u.consumed + d.qty);
    u.consumers.push(d);
  }

  // Finalize derived fields.
  for (const u of out.values()) {
    u.remaining = round2(u.capacity - u.consumed);
    u.usedUp = u.capacity > 0 ? u.remaining <= 0 : u.consumed > 0;
    u.fraction = u.capacity > 0 ? Math.min(1, u.consumed / u.capacity) : u.consumed > 0 ? 1 : 0;
  }

  return out;
}

/** Convenience: just the remaining quantity for one Test ID (∞-safe when no cap). */
export function remainingFor(usage: Map<string, TestIdUsage>, testId: string): number | null {
  const u = usage.get(testId);
  if (!u) return null;
  return u.remaining;
}
