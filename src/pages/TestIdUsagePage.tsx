/**
 * Test ID Usage (NEW). Shows, for every Test ID issued by a sample, how much of
 * its logged quantity is still available: Capacity − Consumed = Remaining, where
 * Consumed is everything tied to that Test ID across the Evidence-of-Inspection
 * rows (contract-scoped here, program-wide on the global Materials route). Used-up
 * Test IDs are flagged red. Clicking a row reveals which inventory entries drew it
 * down, each linking back to the inventory item.
 *
 * Same grid pattern as the Samples page. Wired as both a contract-scoped page and
 * a global one under the Materials menu.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { DataGrid } from "@/components/ui/DataGrid";
import { Pill } from "@/components/ui/Pill";
import { sampleTone } from "@/domain/status";
import { formatNumber } from "@/lib/format";
import type { SampleStatus } from "@/domain/types";
import type { TestIdUsage } from "@/domain/rules/testIdUsage";
import { XIcon } from "@/components/ui/icons";

export function TestIdUsagePage() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const testIdUsageFn = useStore((s) => s.testIdUsage);
  const eoiDeltas = useStore((s) => s.eoiDeltas);
  const ledgerDeltas = useStore((s) => s.ledgerDeltas);
  const eoiRowDeltas = useStore((s) => s.eoiRowDeltas);
  const samplesList = useStore((s) => s.samplesList);
  const [selected, setSelected] = useState<TestIdUsage | null>(null);

  const rows = useMemo(() => {
    const map = testIdUsageFn(contractId);
    return [...map.values()].sort(
      (a, b) =>
        Number(b.usedUp) - Number(a.usedUp) || a.remaining - b.remaining || a.testId.localeCompare(b.testId),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIdUsageFn, contractId, eoiDeltas, ledgerDeltas, eoiRowDeltas, samplesList]);

  const usedUpCount = rows.filter((r) => r.usedUp).length;

  const columns: ColumnDef<TestIdUsage>[] = [
    {
      id: "testId",
      accessorKey: "testId",
      header: "Test ID",
      size: 110,
      cell: ({ row }) => (
        <span className={["font-mono text-[13px] font-semibold", row.original.usedUp ? "text-red-600" : "text-ink"].join(" ")}>
          {row.original.testId}
        </span>
      ),
    },
    {
      id: "material",
      accessorFn: (r) => `${r.materialCode} ${r.materialName}`,
      header: "Material",
      size: 240,
      meta: { grow: true },
      cell: ({ row }) => (
        <span>
          <span className="font-mono text-[13px] font-semibold">{row.original.materialCode}</span>{" "}
          <span className="text-ink-soft">{row.original.materialName}</span>
        </span>
      ),
    },
    {
      id: "capacity",
      accessorKey: "capacity",
      header: "Capacity",
      size: 120,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-ink-soft">
          {formatNumber(row.original.capacity, 0)} {row.original.unit}
        </span>
      ),
    },
    {
      id: "consumed",
      accessorKey: "consumed",
      header: "Consumed",
      size: 120,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.consumed, 0)}</span>,
    },
    {
      id: "remaining",
      accessorKey: "remaining",
      header: "Remaining",
      size: 120,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className={["font-semibold tabular-nums", row.original.usedUp ? "text-red-600" : "text-green-700"].join(" ")}>
          {formatNumber(row.original.remaining, 0)}
        </span>
      ),
    },
    {
      id: "bar",
      header: "Usage",
      size: 140,
      enableSorting: false,
      cell: ({ row }) => <UsageBar fraction={row.original.fraction} usedUp={row.original.usedUp} />,
    },
    {
      id: "sample",
      accessorFn: (r) => r.sample?.status ?? "",
      header: "Sample",
      size: 120,
      cell: ({ row }) =>
        row.original.sample ? (
          <Pill tone={sampleTone(row.original.sample.status as SampleStatus)}>{row.original.sample.status}</Pill>
        ) : (
          <span className="text-xs text-ink-faint">no sample</span>
        ),
    },
  ];

  const title = contract ? `Test ID Usage — ${contract.number}` : "Test ID Usage";
  const subtitle = contract
    ? "Remaining sample quantity per Test ID on this contract. Red rows are used up."
    : "Remaining sample quantity per Test ID across every contract in scope. Red rows are used up.";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="text-xs text-ink-soft">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-ink-soft">
            <span className="font-semibold tabular-nums text-ink">{rows.length}</span> Test IDs
          </span>
          {usedUpCount > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              {usedUpCount} used up
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          data={rows}
          columns={columns}
          getRowId={(r) => r.testId}
          minWidth={1080}
          toolbar
          searchable
          searchPlaceholder="Filter by Test ID, material…"
          countLabel="Test IDs"
          globalSearchText={(r) => `${r.testId} ${r.materialCode} ${r.materialName} ${r.sample?.status ?? ""}`}
          onRowClick={(r) => setSelected(r)}
          emptyMessage="No Test IDs are in use yet."
        />
      </div>

      {selected && (
        <ConsumersPanel
          usage={selected}
          onClose={() => setSelected(null)}
          onOpenItem={(cid, itemId) => navigate(`/contract/${cid}/inventory/${itemId}`)}
        />
      )}
    </div>
  );
}

function UsageBar({ fraction, usedUp }: { fraction: number; usedUp: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
        <div
          className={["h-full rounded-full", usedUp ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-accent"].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">{pct}%</span>
    </div>
  );
}

function ConsumersPanel({
  usage,
  onClose,
  onOpenItem,
}: {
  usage: TestIdUsage;
  onClose: () => void;
  onOpenItem: (contractId: string, itemId: string) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-[92vw] flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-ink">Test ID {usage.testId}</div>
            <div className="truncate text-xs text-ink-soft">
              {usage.materialCode} {usage.materialName}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-md p-1 text-ink-faint hover:bg-canvas">
            <XIcon className="text-base" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-line px-4 py-3 text-center">
          <Stat label="Capacity" value={`${formatNumber(usage.capacity, 0)} ${usage.unit}`} />
          <Stat label="Consumed" value={formatNumber(usage.consumed, 0)} />
          <Stat label="Remaining" value={formatNumber(usage.remaining, 0)} tone={usage.usedUp ? "neg" : "pos"} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Drawn down by ({usage.consumers.length})
          </div>
          {usage.consumers.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing has drawn on this Test ID yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {usage.consumers.map((c, i) => (
                <li key={`${c.inventoryItemId}_${i}`}>
                  <button
                    onClick={() => onOpenItem(c.contractId, c.inventoryItemId)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-[13px] font-semibold text-ink">{c.contractNumber}</span>
                      <span className="ml-2 text-ink-soft">Inv {c.inventoryDisplayId}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft">
                      {formatNumber(c.qty, 0)} {usage.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div
        className={["text-sm font-semibold tabular-nums", tone === "pos" ? "text-green-700" : tone === "neg" ? "text-red-600" : "text-ink"].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
