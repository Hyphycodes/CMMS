/**
 * Pay Estimate (brief 09). List + create-from-placements + summary + submit.
 * Money math is the shared, visible qty × price (no hidden rounding); eligible
 * placements are Placed + posted + not already on an estimate. Replaces the stub.
 */
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { finalOutGate } from "@/domain/rules";
import type { PayEstimate, PayEstimateLine } from "@/domain/types";
import { TabBar } from "@/components/ui/TabBar";
import { Pill } from "@/components/ui/Pill";
import { DataGrid } from "@/components/ui/DataGrid";
import { FieldGroup } from "@/components/ui/FieldGroup";
import type { PillTone } from "@/domain/status";
import { formatMoney, formatDate, formatNumber } from "@/lib/format";

const STATUS_TONE: Record<PayEstimate["status"], PillTone> = {
  Draft: "slate",
  Submitted: "blue",
  Approved: "indigo",
  Paid: "green",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export function PayEstimatePage() {
  const { contractId = "" } = useParams();
  const contract = useStore((s) => s.contract(contractId));
  const canAccess = useStore((s) => s.canAccessContract(contractId));
  const canSubmit = useStore((s) => s.can("submit_pay_estimate"));
  const payEstimatesList = useStore((s) => s.payEstimatesList);
  const createPayEstimate = useStore((s) => s.createPayEstimate);
  const submitPayEstimate = useStore((s) => s.submitPayEstimate);

  const estimates = useMemo(
    () => payEstimatesList.filter((e) => e.contractId === contractId).sort((a, b) => a.number - b.number),
    [payEstimatesList, contractId],
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const selected = estimates.find((e) => e.id === selectedId) ?? estimates[estimates.length - 1];

  if (!contract) return <div className="grid h-full place-items-center text-ink-soft">Select a contract.</div>;
  if (!canAccess)
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">You don't have access to contract {contract.number}.</div>;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-ink">Pay Estimates</h1>
            <p className="text-xs text-ink-soft">{estimates.length} estimates</p>
          </div>
          {canSubmit && (
            <button onClick={() => setCreating(true)} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover">
              + Create
            </button>
          )}
        </div>
        {estimates.map((e) => {
          const active = selected?.id === e.id;
          return (
            <button key={e.id} onClick={() => setSelectedId(e.id)} className={["block w-full border-b border-line/70 px-4 py-2.5 text-left transition", active ? "bg-accent-soft" : "hover:bg-canvas"].join(" ")}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Estimate #{e.number}</span>
                <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill>
                {e.isFinal && <Pill tone="green">Final</Pill>}
              </div>
              <div className="text-xs text-ink-soft">{formatDate(e.periodStart)} – {formatDate(e.periodEnd)}</div>
              <div className="text-xs font-medium tabular-nums text-ink">{formatMoney(e.thisEstimateTotal)}</div>
            </button>
          );
        })}
        {estimates.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">No estimates yet.</p>}

        <FinalOutPanel contractId={contractId} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <EstimateSummary estimate={selected} onSubmit={() => submitPayEstimate(selected.id)} canSubmit={canSubmit} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-soft">Create the first pay estimate.</div>
        )}
      </div>

      {creating && (
        <CreateForm
          onClose={() => setCreating(false)}
          onCreate={(start, end) => {
            const id = createPayEstimate(contractId, start, end);
            setCreating(false);
            if (id) setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

/** M3 — the process-to-final-out gate (Appendix H), driven by the rules layer. */
function FinalOutPanel({ contractId }: { contractId: string }) {
  const navigate = useNavigate();
  const contract = useStore((s) => s.contract(contractId));
  const items = useStore((s) => s.items);
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const authorizationsList = useStore((s) => s.authorizationsList);
  const processFinalOut = useStore((s) => s.processFinalOut);
  const canSubmit = useStore((s) => s.can("submit_pay_estimate"));

  const gate = useMemo(() => {
    if (!contract) return [];
    return finalOutGate(contract, {
      items: items.filter((i) => i.contractId === contractId),
      payItems: payItemsByContract.get(contractId) ?? [],
      authorizations: authorizationsList.filter((a) => a.contractId === contractId),
    });
  }, [contract, items, payItemsByContract, authorizationsList, contractId]);
  if (!contract) return null;
  const ready = gate.every((r) => r.ok);

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Final Out (Appendix H)</div>
      <ul className="mb-2 space-y-1">
        {gate.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-xs">
            <span className={r.ok ? "text-green-600" : "text-amber-600"}>{r.ok ? "✓" : "○"}</span>
            {r.href && !r.ok ? (
              <button onClick={() => navigate(r.href!)} className="text-left text-ink-soft hover:text-accent hover:underline">{r.message}</button>
            ) : (
              <span className="text-ink-soft">{r.message}</span>
            )}
          </li>
        ))}
      </ul>
      {canSubmit && (
        <button
          onClick={() => processFinalOut(contractId)}
          disabled={!ready}
          title={ready ? "Process the latest estimate as the Final Pay Estimate" : "Resolve the gate items first"}
          className="w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
        >
          Process to Final Out
        </button>
      )}
    </div>
  );
}

function EstimateSummary({ estimate, onSubmit, canSubmit }: { estimate: PayEstimate; onSubmit: () => void; canSubmit: boolean }) {
  const [tab, setTab] = useState<"Summary" | "Line Items">("Summary");
  const locked = estimate.status !== "Draft";

  const columns: ColumnDef<PayEstimateLine>[] = [
    { id: "payItem", accessorKey: "payItemNumber", header: "Pay Item", size: 120, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { id: "desc", accessorKey: "description", header: "Description", size: 280, meta: { grow: true } },
    { id: "unit", accessorKey: "unit", header: "Unit", size: 80 },
    { id: "qty", accessorKey: "quantityThis", header: "Qty This Estimate", size: 150, meta: { align: "right" }, cell: ({ getValue }) => formatNumber(getValue() as number, 2) },
    { id: "price", accessorKey: "unitPrice", header: "Unit Price", size: 120, meta: { align: "right" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "amount", accessorKey: "amount", header: "Amount", size: 130, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-semibold">{formatMoney(getValue() as number)}</span> },
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line bg-surface px-5 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-ink">Estimate #{estimate.number}</span>
          <Pill tone={STATUS_TONE[estimate.status]}>{estimate.status}</Pill>
        </div>
        <div className="ml-auto pb-2">
          {!locked && canSubmit && (
            <button onClick={onSubmit} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover">
              Submit Pay Estimate
            </button>
          )}
          {locked && <span className="text-xs text-ink-soft">Locked · submitted by {estimate.submittedBy} · {formatDate(estimate.submittedAt)}</span>}
        </div>
      </div>
      <TabBar tabs={[{ id: "Summary", label: "Summary" }, { id: "Line Items", label: "Line Items", count: estimate.lines.length }]} active={tab} onChange={setTab} className="bg-surface px-5" />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "Summary" ? (
          <div className="max-w-3xl space-y-4">
            <FieldGroup
              title="Pay Estimate Summary"
              showEmpty
              fields={[
                { label: "Estimate Number", value: estimate.number, type: "number" },
                { label: "Period Start", value: estimate.periodStart, type: "date" },
                { label: "Period End", value: estimate.periodEnd, type: "date" },
                { label: "Status", value: estimate.status },
                { label: "Submitted By", value: estimate.submittedBy ?? "" },
                { label: "Submitted At", value: estimate.submittedAt, type: "date" },
                { label: "This Estimate Total", value: estimate.thisEstimateTotal, type: "money" },
                { label: "To-Date Total", value: estimate.toDateTotal, type: "money" },
              ]}
            />
            <div className="flex gap-6 rounded-card border border-line bg-surface px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">This Estimate</div>
                <div className="text-xl font-bold tabular-nums text-ink">{formatMoney(estimate.thisEstimateTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">To Date</div>
                <div className="text-xl font-bold tabular-nums text-ink">{formatMoney(estimate.toDateTotal)}</div>
              </div>
            </div>
            <p className="text-xs text-ink-faint">Amounts derive as quantity × unit price per line (see Line Items). No hidden rounding.</p>
          </div>
        ) : (
          <div className="h-[480px]">
            <DataGrid data={estimate.lines} columns={columns} getRowId={(l) => l.payItemNumber} emptyMessage="No line items." />
          </div>
        )}
      </div>
    </>
  );
}

function CreateForm({ onClose, onCreate }: { onClose: () => void; onCreate: (start: string, end: string) => void }) {
  const [start, setStart] = useState(() => new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10));
  const [end, setEnd] = useState(todayISO());
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20" onClick={onClose}>
      <div className="w-[420px] max-w-[92vw] rounded-xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink">Create Pay Estimate</h2>
        <p className="mt-1 text-sm text-ink-soft">Pulls eligible placements (Placed, posted, not on a prior estimate) in this period.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Period Start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Period End</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={() => onCreate(start, end)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Create</button>
        </div>
      </div>
    </div>
  );
}
