/**
 * P4 — append-only history derived from the ordered delta log (F1). Every edit
 * to a shared record is already an op in the log; this exposes it as a per-record
 * history (who / when / what changed) and provides a content hash so signed /
 * published artifacts are tamper-evident.
 */
import * as deltaLog from "@/data/deltaLog";
import type { DeltaEntity } from "@/data/deltaLog";

export interface HistoryEntry {
  seq: number;
  ts: number;
  by: string;
  org: string;
  op: "upsert" | "delete";
  /** human field-level summary of what changed vs. the previous op */
  changes: { field: string; from: unknown; to: unknown }[];
}

const IGNORED = new Set(["version", "updatedAt", "updatedBy", "updatedByOrg", "createdAt", "createdBy", "createdByOrg", "url"]);

function diff(prev: unknown, next: unknown): { field: string; from: unknown; to: unknown }[] {
  if (typeof next !== "object" || next === null) {
    return prev === next ? [] : [{ field: "value", from: prev, to: next }];
  }
  const out: { field: string; from: unknown; to: unknown }[] = [];
  const prevObj = (prev ?? {}) as Record<string, unknown>;
  const nextObj = next as Record<string, unknown>;
  for (const key of Object.keys(nextObj)) {
    if (IGNORED.has(key)) continue;
    const a = prevObj[key];
    const b = nextObj[key];
    if (typeof b === "object") continue; // skip nested for the summary
    if (a !== b) out.push({ field: key, from: a, to: b });
  }
  return out;
}

/** History for one record, newest first. Empty when no edits are in the log yet. */
export function historyForEntity(entity: DeltaEntity, entityId: string): HistoryEntry[] {
  const ops = deltaLog.all().filter((o) => o.entity === entity && o.entityId === entityId);
  const entries: HistoryEntry[] = [];
  let prev: unknown = undefined;
  for (const op of ops) {
    entries.push({
      seq: op.seq,
      ts: op.ts,
      by: op.userId,
      org: op.orgId,
      op: op.op,
      changes: diff(prev, op.payload),
    });
    prev = op.payload;
  }
  return entries.reverse();
}

/**
 * Stable, fast content hash (FNV-1a) over the signed/published content. Not a
 * cryptographic guarantee — enough to make silent edits to a signed artifact
 * detectable before a DOT leans on the record.
 */
export function contentHash(value: unknown): string {
  const json = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
