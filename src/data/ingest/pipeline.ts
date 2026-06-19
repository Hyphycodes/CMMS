/**
 * F4 — one ingestion spine for every source. Stages:
 *   parse → normalize → validate → stage (preview + column-map) → dedup → commit
 * `commit` writes through the store's optimistic persist, so imports are deltas
 * like everything else (replay/offline come free from F1). Adding a new source is
 * a new `parse` impl only (see sources/csv.ts, sources/wctb.ts).
 */
import type { InventoryItem } from "@/domain/types";

/** A raw row from any source: header → cell, all strings. */
export type RawRow = Record<string, string>;

/** The canonical inventory fields a source maps onto. */
export const INVENTORY_TARGET_FIELDS = [
  "inventoryId",
  "contractNumber",
  "materialCode",
  "materialName",
  "materialUnit",
  "producerNumber",
  "producerName",
  "supplierNumber",
  "supplierName",
] as const;
export type TargetField = (typeof INVENTORY_TARGET_FIELDS)[number];

/** Column mapping: target field → source header. */
export type ColumnMapping = Partial<Record<TargetField, string>>;

export type StageAction = "create" | "update" | "skip" | "error";

export interface StagedRow {
  action: StageAction;
  /** the resolved inventory item (for create/update) */
  item?: InventoryItem;
  /** the existing item id when updating */
  existingId?: string;
  error?: string;
  raw: RawRow;
}

export interface StageResult {
  rows: StagedRow[];
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/** Best-effort auto-map: exact, case-insensitive, and de-spaced header matches. */
export function autoMap(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const map: ColumnMapping = {};
  const aliases: Record<TargetField, string[]> = {
    inventoryId: ["inventoryid", "invid", "id"],
    contractNumber: ["contractnumber", "contract", "contractno"],
    materialCode: ["materialcode", "code", "matcode"],
    materialName: ["materialname", "material", "description", "name"],
    materialUnit: ["materialunit", "unit", "uom"],
    producerNumber: ["producernumber", "producerno", "prodno"],
    producerName: ["producername", "producer"],
    supplierNumber: ["suppliernumber", "supplierno", "suppno"],
    supplierName: ["suppliername", "supplier"],
  };
  for (const field of INVENTORY_TARGET_FIELDS) {
    for (const a of aliases[field]) {
      if (byNorm.has(a)) {
        map[field] = byNorm.get(a)!;
        break;
      }
    }
  }
  return map;
}

/**
 * Normalize + validate + stage + dedup against existing inventory. Pure — the
 * preview renders this; commit consumes the create/update rows.
 */
export function stageInventory(
  rows: RawRow[],
  mapping: ColumnMapping,
  existing: InventoryItem[],
  contractIdForNumber: (num: string) => string | undefined,
): StageResult {
  const byInvId = new Map(existing.map((i) => [i.inventoryId, i]));
  const seen = new Set<string>();
  const staged: StagedRow[] = rows.map((raw) => {
    const get = (f: TargetField) => (mapping[f] ? (raw[mapping[f]!] ?? "").trim() : "");
    const materialCode = get("materialCode");
    const contractNumber = get("contractNumber");
    if (!materialCode || !contractNumber) {
      return { action: "error", error: "Missing material code or contract number", raw };
    }
    const contractId = contractIdForNumber(contractNumber);
    if (!contractId) {
      return { action: "error", error: `Unknown contract ${contractNumber}`, raw };
    }
    const inventoryId = get("inventoryId") || `${contractNumber}-${materialCode}`;
    if (seen.has(inventoryId)) return { action: "skip", error: "Duplicate in this file", raw };
    seen.add(inventoryId);

    const existingItem = byInvId.get(inventoryId);
    const base: InventoryItem = existingItem ?? {
      id: `imp_${inventoryId}_${Math.random().toString(36).slice(2, 8)}`,
      inventoryId,
      contractId,
      contractNumber,
      materialCode,
      materialName: get("materialName") || materialCode,
      materialUnit: get("materialUnit") || "Each",
      producerNumber: get("producerNumber"),
      producerName: get("producerName"),
      supplierNumber: get("supplierNumber"),
      supplierName: get("supplierName"),
      status: "Needs Attention",
      note: "",
      payItemNumbers: [],
      readyAt: null,
    };
    const item: InventoryItem = {
      ...base,
      contractId,
      contractNumber,
      materialCode,
      materialName: get("materialName") || base.materialName,
      materialUnit: get("materialUnit") || base.materialUnit,
      producerNumber: get("producerNumber") || base.producerNumber,
      producerName: get("producerName") || base.producerName,
      supplierNumber: get("supplierNumber") || base.supplierNumber,
      supplierName: get("supplierName") || base.supplierName,
    };
    return existingItem
      ? { action: "update", item, existingId: existingItem.id, raw }
      : { action: "create", item, raw };
  });

  return {
    rows: staged,
    created: staged.filter((r) => r.action === "create").length,
    updated: staged.filter((r) => r.action === "update").length,
    skipped: staged.filter((r) => r.action === "skip").length,
    errors: staged.filter((r) => r.action === "error").length,
  };
}
