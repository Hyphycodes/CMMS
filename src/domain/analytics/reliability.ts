/**
 * X3 — vendor / material reliability benchmarking. Pure aggregation over the
 * provenance/history that's already accrued (samples + inventory review state) —
 * intelligence no single contract reveals. No new capture.
 */
import type { Sample, InventoryItem } from "@/domain/types";

export interface ReliabilityRow {
  key: string;
  label: string;
  samples: number;
  approved: number;
  rejected: number;
  items: number;
  reviewComplete: number;
  needsAttention: number;
  /** 0–100 over decided outcomes (sample approvals + completed inventory reviews) */
  reliabilityPct: number;
  /** sample rejection rate 0–100 (lower is better) */
  rejectionPct: number;
}

function aggregate(
  keyOf: { sample: (s: Sample) => string; item: (i: InventoryItem) => string; label: (k: string) => string },
  samples: Sample[],
  items: InventoryItem[],
): ReliabilityRow[] {
  const map = new Map<string, ReliabilityRow>();
  const get = (k: string) => {
    let r = map.get(k);
    if (!r) {
      r = { key: k, label: keyOf.label(k), samples: 0, approved: 0, rejected: 0, items: 0, reviewComplete: 0, needsAttention: 0, reliabilityPct: 0, rejectionPct: 0 };
      map.set(k, r);
    }
    return r;
  };
  for (const s of samples) {
    if (!s.producerName) continue;
    const r = get(keyOf.sample(s));
    r.samples++;
    if (s.status === "Approved") r.approved++;
    else if (s.status === "Rejected") r.rejected++;
  }
  for (const i of items) {
    const r = get(keyOf.item(i));
    r.items++;
    if (i.status === "Review Complete") r.reviewComplete++;
    else if (i.status === "Needs Attention") r.needsAttention++;
  }
  for (const r of map.values()) {
    const decided = r.approved + r.rejected + r.reviewComplete + r.needsAttention;
    r.reliabilityPct = decided ? Math.round(((r.approved + r.reviewComplete) / decided) * 100) : 0;
    const sampleDecided = r.approved + r.rejected;
    r.rejectionPct = sampleDecided ? Math.round((r.rejected / sampleDecided) * 100) : 0;
  }
  return [...map.values()].filter((r) => r.samples + r.items > 0).sort((a, b) => b.samples + b.items - (a.samples + a.items));
}

export function vendorReliability(samples: Sample[], items: InventoryItem[]): ReliabilityRow[] {
  return aggregate(
    { sample: (s) => s.producerName, item: (i) => i.producerName || "—", label: (k) => k },
    samples,
    items,
  );
}

export function materialReliability(samples: Sample[], items: InventoryItem[]): ReliabilityRow[] {
  const nameByCode = new Map<string, string>();
  for (const i of items) nameByCode.set(i.materialCode, i.materialName);
  for (const s of samples) nameByCode.set(s.materialCode, s.materialName);
  return aggregate(
    { sample: (s) => s.materialCode, item: (i) => i.materialCode, label: (k) => `${k} · ${nameByCode.get(k) ?? ""}` },
    samples,
    items,
  );
}
