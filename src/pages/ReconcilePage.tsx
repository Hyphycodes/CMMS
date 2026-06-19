/**
 * X4 — reconciliation diff vs. the official record. Pick a contract, load its
 * official CSV export (or generate a sample), and diff field-by-field against
 * Proof's state. Mismatches link to the record. Trust artifact + sync-back seam.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { parseCsv } from "@/data/ingest/sources/csv";
import { reconcileInventory, type ReconcileResult } from "@/domain/analytics/reconcile";
import { Pill } from "@/components/ui/Pill";
import { inventoryTone } from "@/domain/status";

export function ReconcilePage() {
  const navigate = useNavigate();
  const contracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const items = useStore((s) => s.items);
  const fileRef = useRef<HTMLInputElement>(null);

  const withItems = useMemo(
    () => contracts.filter((c) => visibleIds.has(c.id) && c.inventoryCount > 0),
    [contracts, visibleIds],
  );
  const [contractId, setContractId] = useState(withItems[0]?.id ?? "");
  const [rows, setRows] = useState<ReturnType<typeof parseCsv>["rows"]>([]);

  const scopedItems = useMemo(() => items.filter((i) => i.contractId === contractId), [items, contractId]);

  const result: ReconcileResult | null = useMemo(() => {
    if (!rows.length) return null;
    return reconcileInventory(rows, scopedItems, { inventoryId: "Inventory ID", status: "Status", materialName: "Material Name", producerName: "Producer" });
  }, [rows, scopedItems]);

  const generateSample = () => {
    // Build a plausible official export from current data, with two deliberate
    // discrepancies so the diff demonstrates mismatches.
    const lines = ["Inventory ID,Contract,Material Code,Material Name,Producer,Status"];
    scopedItems.slice(0, 40).forEach((i, idx) => {
      const status = idx === 1 ? "Needs Attention" : idx === 3 ? "Review Complete" : i.status ?? "";
      lines.push(`${i.inventoryId},${i.contractNumber},${i.materialCode},"${i.materialName}",${i.producerName},${status}`);
    });
    // an only-in-official row
    lines.push(`OFFICIAL-9999,${withItems.find((c) => c.id === contractId)?.number ?? ""},99999999,"ONLY IN OFFICIAL EXPORT",,Needs Attention`);
    setRows(parseCsv(lines.join("\n")).rows);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Reconcile vs. Official Record</h1>
          <p className="text-sm text-ink-soft">Diff an official CMMS export against Proof's state, field by field. Mismatches link to the record.</p>
        </div>

        <section className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-ink-soft">Contract:</label>
            <select value={contractId} onChange={(e) => { setContractId(e.target.value); setRows([]); }} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none">
              {withItems.map((c) => (
                <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
              ))}
            </select>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Load official CSV…</button>
            <button onClick={generateSample} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Generate sample export</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => setRows(parseCsv(t).rows)); e.target.value = ""; }} />
          </div>
        </section>

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Tie out" value={result.matches} tone="green" />
              <Stat label="Mismatches" value={result.mismatches.length} tone={result.mismatches.length ? "red" : "slate"} />
              <Stat label="Only in official" value={result.onlyOfficial.length} tone={result.onlyOfficial.length ? "amber" : "slate"} />
              <Stat label="Only in Proof" value={result.onlyProof.length} tone="slate" />
            </div>

            {result.mismatches.length > 0 && (
              <section className="rounded-card border border-line bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">Mismatches ({result.mismatches.length})</h2>
                <ul className="divide-y divide-line">
                  {result.mismatches.map((m) => (
                    <li key={m.item.id} className="py-2">
                      <button onClick={() => navigate(`/contract/${m.item.contractId}/inventory/${m.item.id}`)} className="flex w-full items-center gap-2 text-left hover:underline">
                        <span className="font-mono text-[13px] font-semibold text-ink">{m.item.inventoryId}</span>
                        <span className="text-sm text-ink-soft">{m.item.materialCode} {m.item.materialName}</span>
                        <span className="ml-auto text-xs text-accent">Open →</span>
                      </button>
                      <div className="mt-1 space-y-0.5 pl-1">
                        {m.diffs.map((d) => (
                          <div key={d.field} className="text-xs text-ink-soft">
                            <span className="font-medium text-ink">{d.field}</span>: Proof <span className="text-emerald-700">{d.proof}</span> · Official <span className="text-amber-700">{d.official}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.onlyOfficial.length > 0 && (
              <section className="rounded-card border border-line bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">Only in official export ({result.onlyOfficial.length})</h2>
                <ul className="space-y-1 text-sm text-ink-soft">
                  {result.onlyOfficial.slice(0, 30).map((r, i) => (
                    <li key={i}><span className="font-mono text-[12px]">{r["Inventory ID"]}</span> · {r["Material Code"]} {r["Material Name"]}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.onlyProof.length > 0 && (
              <section className="rounded-card border border-line bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">Only in Proof ({result.onlyProof.length})</h2>
                <ul className="space-y-1 text-sm">
                  {result.onlyProof.slice(0, 30).map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-ink">{i.inventoryId}</span>
                      <span className="text-ink-soft">{i.materialCode} {i.materialName}</span>
                      <Pill tone={inventoryTone(i.status)}>{i.status ?? "—"}</Pill>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "amber" | "slate" }) {
  const color = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-ink";
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${value > 0 ? color : "text-ink"}`}>{value}</div>
    </div>
  );
}
