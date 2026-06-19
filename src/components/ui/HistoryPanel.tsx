/**
 * P4 — per-record change history, read from the ordered delta log. Reused on the
 * Inventory drawer, Sample drawer, and Authorizations. Shows who/when + the
 * field-level old→new for each edit.
 */
import { useStore } from "@/store/store";
import { historyForEntity } from "@/domain/history";
import type { DeltaEntity } from "@/data/deltaLog";

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

export function HistoryPanel({ entity, entityId }: { entity: DeltaEntity; entityId: string }) {
  // subscribe to pendingChanges so the panel refreshes after a new op lands
  useStore((s) => s.pendingChanges);
  const users = useStore((s) => s.users);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const entries = historyForEntity(entity, entityId);

  if (entries.length === 0) {
    return <p className="text-sm text-ink-faint">No edits recorded yet. Changes you make here will appear in this history.</p>;
  }
  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <li key={e.seq} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">{nameOf(e.by)}</span>
            <span className="text-xs text-ink-faint">{new Date(e.ts).toLocaleString()}</span>
          </div>
          {e.changes.length === 0 ? (
            <div className="text-xs text-ink-soft">{e.op === "delete" ? "Removed" : "Saved"}</div>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {e.changes.slice(0, 8).map((c, i) => (
                <li key={i} className="text-xs text-ink-soft">
                  <span className="font-medium text-ink">{c.field}</span>: <span className="text-ink-faint line-through">{fmt(c.from)}</span> → {fmt(c.to)}
                </li>
              ))}
              {e.changes.length > 8 && <li className="text-xs text-ink-faint">+{e.changes.length - 8} more</li>}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
