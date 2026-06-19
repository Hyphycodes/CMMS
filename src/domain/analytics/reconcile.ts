/**
 * X4 — reconciliation diff vs. the official record. Ingest an official export
 * (via the F4 CSV parser) and diff it field-by-field against Proof's state so
 * inspectors can trust the numbers tie out — the "better window first" play.
 */
import type { InventoryItem } from "@/domain/types";
import type { RawRow } from "@/data/ingest/pipeline";

export interface FieldDiff {
  field: string;
  proof: string;
  official: string;
}
export interface MismatchRow {
  item: InventoryItem;
  diffs: FieldDiff[];
}
export interface ReconcileResult {
  matches: number;
  mismatches: MismatchRow[];
  onlyOfficial: RawRow[];
  onlyProof: InventoryItem[];
}

/** Map of official-CSV header → meaning. Defaults assume the export's own labels. */
export interface ReconcileMapping {
  inventoryId: string;
  status: string;
  materialName?: string;
  producerName?: string;
}

export function reconcileInventory(rows: RawRow[], items: InventoryItem[], map: ReconcileMapping): ReconcileResult {
  const byInvId = new Map(items.map((i) => [i.inventoryId, i]));
  const seen = new Set<string>();
  const mismatches: MismatchRow[] = [];
  const onlyOfficial: RawRow[] = [];
  let matches = 0;

  for (const row of rows) {
    const invId = (row[map.inventoryId] ?? "").trim();
    if (!invId) continue;
    const item = byInvId.get(invId);
    if (!item) {
      onlyOfficial.push(row);
      continue;
    }
    seen.add(invId);
    const diffs: FieldDiff[] = [];
    const cmp = (field: string, proof: string, official: string) => {
      if ((proof ?? "").trim() !== (official ?? "").trim()) diffs.push({ field, proof: proof || "—", official: official || "—" });
    };
    cmp("status", item.status ?? "", (row[map.status] ?? "").trim());
    if (map.materialName) cmp("materialName", item.materialName, (row[map.materialName] ?? "").trim());
    if (map.producerName) cmp("producerName", item.producerName, (row[map.producerName] ?? "").trim());
    if (diffs.length) mismatches.push({ item, diffs });
    else matches++;
  }

  // `items` is expected to be pre-scoped (e.g. one contract) by the caller, so
  // anything not seen in the official file is genuinely only-in-Proof.
  const onlyProof = items.filter((i) => !seen.has(i.inventoryId));
  return { matches, mismatches, onlyOfficial, onlyProof };
}
