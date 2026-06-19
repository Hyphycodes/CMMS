/**
 * X3 — vendor / material reliability view. Ranks producers and materials by
 * approval / rejection / review-completion across all loaded contracts, sourced
 * entirely from existing samples + inventory state.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { vendorReliability, materialReliability, type ReliabilityRow } from "@/domain/analytics/reliability";

export function ReliabilityPage() {
  const samplesList = useStore((s) => s.samplesList);
  const items = useStore((s) => s.items);
  const visibleIds = useStore((s) => s.visibleIds);
  const [mode, setMode] = useState<"vendor" | "material">("vendor");

  const rows = useMemo(() => {
    const samples = samplesList.filter((s) => s.contractId === null || visibleIds.has(s.contractId));
    const scopedItems = items.filter((i) => visibleIds.has(i.contractId));
    return mode === "vendor" ? vendorReliability(samples, scopedItems) : materialReliability(samples, scopedItems);
  }, [samplesList, items, visibleIds, mode]);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Vendor / Material Reliability</h1>
          <p className="text-sm text-ink-soft">Approval, rejection, and review-completion rates across contracts — cross-contract intelligence.</p>
        </div>

        <div className="flex gap-2">
          {(["vendor", "material"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition ${mode === m ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas"}`}>
              By {m}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2">{mode === "vendor" ? "Producer" : "Material"}</th>
                <th className="px-4 py-2 text-right">Samples</th>
                <th className="px-4 py-2 text-right">Approved</th>
                <th className="px-4 py-2 text-right">Rejected</th>
                <th className="px-4 py-2 text-right">Inventory</th>
                <th className="px-4 py-2 text-right">Reviewed</th>
                <th className="px-4 py-2 text-right">Reliability</th>
                <th className="px-4 py-2 text-right">Rejection</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.key} r={r} />
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-4 text-center text-ink-faint">No data in scope.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ r }: { r: ReliabilityRow }) {
  const tone = r.reliabilityPct >= 80 ? "text-emerald-700" : r.reliabilityPct >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <tr className="border-t border-line/70">
      <td className="px-4 py-2 font-medium text-ink">{r.label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{r.samples}</td>
      <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{r.approved}</td>
      <td className="px-4 py-2 text-right tabular-nums text-red-700">{r.rejected}</td>
      <td className="px-4 py-2 text-right tabular-nums">{r.items}</td>
      <td className="px-4 py-2 text-right tabular-nums">{r.reviewComplete}</td>
      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${tone}`}>{r.reliabilityPct}%</td>
      <td className="px-4 py-2 text-right tabular-nums text-ink-soft">{r.rejectionPct}%</td>
    </tr>
  );
}
