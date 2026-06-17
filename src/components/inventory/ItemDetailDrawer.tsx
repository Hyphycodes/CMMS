import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { buildDetail } from "@/data/seed/generate";
import {
  INVENTORY_STATUSES,
  EOI_APPROVALS,
  type EOIEntry,
  type InventoryDetail,
} from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { inventoryTone, eoiTone, payItemTone, groupTone } from "@/domain/status";
import { formatDate, formatQty, formatNumber } from "@/lib/format";

const TABS = ["Details", "Quantity Ledger", "Evidence of Inspection", "Pay Item Materials"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_PAY_ITEMS: never[] = []; // stable reference for the no-item case

export function ItemDetailDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId));
  const payItems = useStore((s) => (item ? s.payItemsFor(item.contractId) : EMPTY_PAY_ITEMS));
  const eoiDeltas = useStore((s) => s.eoiDeltas);
  const setInventoryStatus = useStore((s) => s.setInventoryStatus);
  const [tab, setTab] = useState<Tab>("Details");

  // Build detail in a memo (NOT a store selector — buildDetail returns a new
  // object each call, which would loop useSyncExternalStore). Overlay EOI deltas.
  const detail = useMemo<InventoryDetail | undefined>(() => {
    if (!item) return undefined;
    const d = buildDetail(item, payItems);
    d.eoi = d.eoi.map((row) => {
      const delta = eoiDeltas[`${itemId}:${row.id}`];
      return delta ? { ...row, approval: delta.approval, note: delta.note } : row;
    });
    return d;
  }, [item, payItems, eoiDeltas, itemId]);

  if (!item || !detail) return null;

  const tabs = TABS.map((t) => ({
    id: t,
    label: t,
    count:
      t === "Quantity Ledger"
        ? detail.ledger.length
        : t === "Evidence of Inspection"
          ? detail.eoi.length
          : t === "Pay Item Materials"
            ? detail.payItemMaterials.length
            : 0,
  }));

  return (
    <DetailDrawer<Tab>
      eyebrow={
        <>
          <span className="font-mono text-sm text-ink-faint">Inventory {item.inventoryId}</span>
          <Pill tone={inventoryTone(item.status)}>{item.status}</Pill>
        </>
      }
      title={
        <>
          <span className="font-mono">{item.materialCode}</span>
          <span className="mx-1.5 text-ink-faint">—</span>
          {item.materialName}
        </>
      }
      subtitle={`Contract ${item.contractNumber} · ${item.producerName}`}
      actions={
        <StatusControl itemId={item.id} status={item.status} detail={detail} onChange={setInventoryStatus} />
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onClose={onClose}
    >
      {tab === "Details" && <DetailsTab detail={detail} />}
      {tab === "Quantity Ledger" && <LedgerTab detail={detail} />}
      {tab === "Evidence of Inspection" && <EOITab detail={detail} itemId={itemId} />}
      {tab === "Pay Item Materials" && <PayItemTab detail={detail} />}
    </DetailDrawer>
  );
}

// --- Status control (enforces Review Complete only when all EOI approved) ---

function StatusControl({
  itemId,
  status,
  detail,
  onChange,
}: {
  itemId: string;
  status: InventoryDetail["status"];
  detail: InventoryDetail;
  onChange: (ids: string[], status: InventoryDetail["status"]) => void;
}) {
  const pushToast = useStore((s) => s.pushToast);
  const unresolved = detail.eoi.filter((r) => r.approval === "Unset").length;
  const blockComplete = unresolved > 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={status}
        onChange={(e) => {
          const next = e.target.value as InventoryDetail["status"];
          if (next === "Review Complete" && blockComplete) {
            pushToast("error", `${unresolved} EOI row${unresolved === 1 ? "" : "s"} still need approval before Review Complete.`);
            return;
          }
          onChange([itemId], next);
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent"
      >
        {INVENTORY_STATUSES.map((s) => (
          <option key={s} value={s} disabled={s === "Review Complete" && blockComplete}>
            {s}
          </option>
        ))}
      </select>
      {blockComplete && (
        <span className="text-[10px] text-amber-700">{unresolved} EOI unreviewed</span>
      )}
    </div>
  );
}

// --- Details ---------------------------------------------------------------

function DetailsTab({ detail }: { detail: InventoryDetail }) {
  const setNote = useStore((s) => s.setInventoryNote);
  const [note, setLocalNote] = useState(detail.note);
  useEffect(() => setLocalNote(detail.note), [detail.id, detail.note]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Material Code" value={detail.materialCode} mono />
        <Field label="Material Name" value={detail.materialName} />
        <Field label="Material Unit of Measure" value={detail.materialUnit} />
        <Field label="Inventory ID" value={detail.inventoryId} mono />
        <Field label="Producer Number" value={detail.producerNumber} mono />
        <Field label="Producer Name" value={detail.producerName} />
        <Field label="Supplier Number" value={detail.supplierNumber} mono />
        <Field label="Supplier Name" value={detail.supplierName} />
        <Field label="Contract Number" value={detail.contractNumber} mono hint="read-only" />
        <Field
          label="Linked Pay Items"
          value={detail.payItemNumbers.join(", ") || "—"}
          mono
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Inventory Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => note !== detail.note && setNote(detail.id, note)}
          rows={3}
          placeholder="Optional — notes about this inventory…"
          className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
        {hint && <span className="ml-1.5 lowercase opacity-70">({hint})</span>}
      </div>
      <div className={["truncate text-sm text-ink", mono ? "font-mono" : ""].join(" ")} title={value}>
        {value}
      </div>
    </div>
  );
}

// --- Quantity Ledger -------------------------------------------------------

function LedgerTab({ detail }: { detail: InventoryDetail }) {
  const received = detail.ledger
    .filter((l) => l.type === "Received")
    .reduce((s, l) => s + l.transactionQty, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm">
        <span className="text-ink-soft">Ledger summary</span>
        <span className="font-semibold text-ink">{formatQty(received, detail.materialUnit)} received</span>
        <span className="text-ink-faint">· {detail.ledger.length} entries</span>
      </div>
      <Table head={["Id", "Date", "Pay Item", "Desc 1", "Desc 2", "Mix Design", "Batch/Lot/Heat", "Type", "Trans. Qty"]}>
        {detail.ledger.map((l) => (
          <tr key={l.id} className="border-b border-line/70">
            <Td mono>{l.id}</Td>
            <Td>{formatDate(l.date)}</Td>
            <Td mono>{l.payItemNumber || "—"}</Td>
            <Td>{l.desc1 || "—"}</Td>
            <Td mono>{l.desc2 || "—"}</Td>
            <Td mono>{l.mixDesign || "—"}</Td>
            <Td mono>{l.batchLotHeat || "—"}</Td>
            <Td>{l.type}</Td>
            <Td num>{formatNumber(l.transactionQty, 2)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// --- Evidence of Inspection (individually approvable) ----------------------

function EOITab({ detail, itemId }: { detail: InventoryDetail; itemId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Every Ledger ID row needs approval before the inventory can be completed. Approved · Approved
        as Exception · Rejected (a note is required for exceptions and rejections).
      </p>
      <div className="space-y-2.5">
        {detail.eoi.map((row) => (
          <EOIRow key={row.id} row={row} itemId={itemId} />
        ))}
      </div>
    </div>
  );
}

function EOIRow({ row, itemId }: { row: EOIEntry; itemId: string }) {
  const setApproval = useStore((s) => s.setEoiApproval);
  const [note, setNote] = useState(row.note);
  useEffect(() => setNote(row.note), [row.id, row.note]);
  const needsNote = row.approval === "Approved as Exception" || row.approval === "Rejected";

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <Meta label="Ledger ID">{row.ledgerIds.join(", ")}</Meta>
        <Meta label="Actual EOI">
          <span className="font-mono">{row.actualEoi.join(" · ") || "—"}</span>
        </Meta>
        <Meta label="MOA">
          <span className="font-mono">{row.actualMoa.join(" · ") || "—"}</span>
        </Meta>
        <Meta label="Test ID">
          <span className="font-mono">{row.testId || "—"}</span>
        </Meta>
        {row.hasDocument && <span className="text-xs text-ink-faint">📎 document</span>}
        <div className="ml-auto">
          <Pill tone={eoiTone(row.approval)}>{row.approval === "Unset" ? "Not reviewed" : row.approval}</Pill>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {EOI_APPROVALS.map((a) => (
          <button
            key={a}
            onClick={() => setApproval(itemId, row.id, a, note)}
            className={[
              "rounded-md border px-2.5 py-1 text-xs font-medium transition",
              row.approval === a
                ? a === "Rejected"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : a === "Approved as Exception"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-green-300 bg-green-50 text-green-700"
                : "border-line text-ink-soft hover:bg-canvas",
            ].join(" ")}
          >
            {a}
          </button>
        ))}
        {row.approval !== "Unset" && (
          <button
            onClick={() => setApproval(itemId, row.id, "Unset", "")}
            className="rounded-md px-2 py-1 text-xs text-ink-faint hover:bg-canvas"
          >
            Reset
          </button>
        )}
      </div>

      {needsNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setApproval(itemId, row.id, row.approval, note)}
          placeholder="Reason required…"
          className={[
            "mt-2 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none",
            note.trim() ? "border-line focus:border-accent" : "border-amber-300 bg-amber-50 focus:border-amber-400",
          ].join(" ")}
        />
      )}
    </div>
  );
}

// --- Pay Item Materials ----------------------------------------------------

function PayItemTab({ detail }: { detail: InventoryDetail }) {
  if (detail.payItemMaterials.length === 0) {
    return <p className="text-sm text-ink-soft">No pay items are linked to this inventory.</p>;
  }
  return (
    <div className="space-y-3">
      {detail.payItemMaterials.map((r) => (
        <div key={r.payItemNumber} className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-ink">{r.payItemNumber}</span>
            <span className="text-sm text-ink">{r.payItemDescription}</span>
            <span className="ml-auto">
              <Pill tone={payItemTone(r.payItemMaterialStatus)}>{r.payItemMaterialStatus}</Pill>
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Metric label="Quantity Provided" value={formatQty(r.materialQuantityProvided, r.materialUnit)} />
            <Metric label="Quantity Required" value={formatQty(r.materialQuantityRequired, r.materialUnit)} />
            <Metric
              label="Balance"
              value={`${r.balance >= 0 ? "+" : ""}${formatNumber(r.balance, 2)} ${r.materialUnit}`}
              tone={r.balance >= 0 ? "pos" : "neg"}
            />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Group {r.group} Status</div>
              <Pill tone={groupTone(r.groupStatus)}>{r.groupStatus}</Pill>
            </div>
          </div>
          <div className="mt-2 text-xs text-ink-faint">
            Pay quantity placed {formatNumber(r.placedQuantity)} {r.payItemUnit} · conversion factor{" "}
            {r.conversionFactor}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- small table + cell primitives ----------------------------------------

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-canvas text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, mono, num }: { children: React.ReactNode; mono?: boolean; num?: boolean }) {
  return (
    <td
      className={[
        "whitespace-nowrap px-3 py-2 text-ink",
        mono ? "font-mono text-[13px]" : "",
        num ? "text-right tabular-nums" : "",
      ].join(" ")}
    >
      {children}
    </td>
  );
}
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="text-ink">{children}</div>
    </div>
  );
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div
        className={[
          "font-medium tabular-nums",
          tone === "pos" ? "text-green-700" : tone === "neg" ? "text-red-700" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
