/**
 * M4 — Reports (manual Appendix G). Each report is a pure query over the in-memory
 * world, rendered to a printable table with CSV export. No new data — read only.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { formatMoney, formatNumber } from "@/lib/format";

interface ReportColumn {
  header: string;
  /** raw value for CSV */
  value: (row: Record<string, unknown>) => string | number;
  /** display (defaults to value) */
  render?: (row: Record<string, unknown>) => string;
  align?: "right";
}
interface ReportDef {
  id: string;
  name: string;
  description: string;
  columns: ReportColumn[];
  rows: () => Record<string, unknown>[];
}

function toCsv(report: ReportDef): string {
  const head = report.columns.map((c) => `"${c.header}"`).join(",");
  const body = report
    .rows()
    .map((r) => report.columns.map((c) => `"${String(c.value(r)).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export function ReportsPage() {
  const contracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const items = useStore((s) => s.items);
  const authorizationsList = useStore((s) => s.authorizationsList);
  const payEstimatesList = useStore((s) => s.payEstimatesList);

  const visible = useMemo(() => contracts.filter((c) => visibleIds.has(c.id)), [contracts, visibleIds]);

  const reports: ReportDef[] = useMemo(() => {
    const byContract = new Map<string, { total: number; na: number; ready: number; done: number }>();
    for (const it of items) {
      if (!visibleIds.has(it.contractId)) continue;
      const e = byContract.get(it.contractId) ?? { total: 0, na: 0, ready: 0, done: 0 };
      e.total++;
      if (it.status === "Needs Attention") e.na++;
      else if (it.status === "Ready for Review") e.ready++;
      else if (it.status === "Review Complete") e.done++;
      byContract.set(it.contractId, e);
    }
    return [
      {
        id: "contract-status",
        name: "Contract Status Summary",
        description: "Status, value, and completion across your contracts.",
        columns: [
          { header: "Contract", value: (r) => r.number as string },
          { header: "Name", value: (r) => r.name as string },
          { header: "Status", value: (r) => r.status as string },
          { header: "Current Amount", value: (r) => r.current as number, render: (r) => formatMoney(r.current as number), align: "right" },
          { header: "Paid to Date", value: (r) => r.paid as number, render: (r) => formatMoney(r.paid as number), align: "right" },
          { header: "% Complete", value: (r) => r.pct as number, render: (r) => `${r.pct}%`, align: "right" },
          { header: "Ready for Review", value: (r) => r.ready as number, align: "right" },
        ],
        rows: () =>
          visible.map((c) => ({
            number: c.number,
            name: c.name,
            status: c.summary.contractStatus,
            current: c.summary.currentContractAmount,
            paid: c.summary.totalPaidToDate,
            pct: c.summary.currentContractAmount ? Math.round((c.summary.totalPaidToDate / c.summary.currentContractAmount) * 100) : 0,
            ready: c.readyForReviewCount,
          })),
      },
      {
        id: "inventory-status",
        name: "Inventory Review Status",
        description: "Inventory counts by review status, per contract.",
        columns: [
          { header: "Contract", value: (r) => r.number as string },
          { header: "Total", value: (r) => r.total as number, align: "right" },
          { header: "Needs Attention", value: (r) => r.na as number, align: "right" },
          { header: "Ready for Review", value: (r) => r.ready as number, align: "right" },
          { header: "Review Complete", value: (r) => r.done as number, align: "right" },
        ],
        rows: () =>
          visible
            .map((c) => ({ number: c.number, ...(byContract.get(c.id) ?? { total: 0, na: 0, ready: 0, done: 0 }) }))
            .filter((r) => (r.total as number) > 0),
      },
      {
        id: "authorizations",
        name: "Authorization Summary",
        description: "Authorizations by type, status, and net change.",
        columns: [
          { header: "Contract", value: (r) => r.contract as string },
          { header: "Auth #", value: (r) => r.number as number, align: "right" },
          { header: "Type", value: (r) => r.type as string },
          { header: "Status", value: (r) => r.status as string },
          { header: "Net Change", value: (r) => r.net as number, render: (r) => formatMoney(r.net as number), align: "right" },
        ],
        rows: () =>
          authorizationsList
            .filter((a) => visibleIds.has(a.contractId))
            .map((a) => ({ contract: contracts.find((c) => c.id === a.contractId)?.number ?? a.contractId, number: a.number, type: a.type, status: a.status, net: a.netChange })),
      },
      {
        id: "pay-estimates",
        name: "Pay Estimate Summary",
        description: "Pay estimates with this-period and to-date totals.",
        columns: [
          { header: "Contract", value: (r) => r.contract as string },
          { header: "Estimate #", value: (r) => r.number as number, align: "right" },
          { header: "Status", value: (r) => r.status as string },
          { header: "This Estimate", value: (r) => r.thisTotal as number, render: (r) => formatMoney(r.thisTotal as number), align: "right" },
          { header: "To Date", value: (r) => r.toDate as number, render: (r) => formatMoney(r.toDate as number), align: "right" },
        ],
        rows: () =>
          payEstimatesList
            .filter((e) => visibleIds.has(e.contractId))
            .map((e) => ({ contract: contracts.find((c) => c.id === e.contractId)?.number ?? e.contractId, number: e.number, status: e.isFinal ? "Final" : e.status, thisTotal: e.thisEstimateTotal, toDate: e.toDateTotal })),
      },
    ];
  }, [visible, items, visibleIds, authorizationsList, payEstimatesList, contracts]);

  const [activeId, setActiveId] = useState(reports[0].id);
  const report = reports.find((r) => r.id === activeId) ?? reports[0];
  const rows = report.rows();

  const exportCsv = () => {
    const blob = new Blob([toCsv(report)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Reports</h1>
          <p className="text-sm text-ink-soft">Appendix G reports — live queries over your contracts, print or export to CSV.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${r.id === activeId ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas"}`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <section className="rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{report.name}</h2>
              <p className="text-xs text-ink-soft">{report.description} · {rows.length} rows</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Print</button>
              <button onClick={exportCsv} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Export CSV</button>
            </div>
          </div>
          <div className="max-h-[calc(100vh-300px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-canvas text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.header} className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/70">
                    {report.columns.map((c) => (
                      <td key={c.header} className={`px-3 py-1.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                        {c.render ? c.render(r) : typeof c.value(r) === "number" ? formatNumber(c.value(r) as number) : String(c.value(r))}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={report.columns.length} className="px-3 py-4 text-center text-ink-faint">No rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
