/**
 * Inventory detail (briefs 01 + 05). Read path unchanged in look; the Quantity
 * Ledger and Evidence of Inspection tabs are now writable, Pay Item Materials
 * carries the documentation-only status setter, and Review Complete is blocked
 * until every EOI row is approved. All writes go through optimistic store
 * mutations (setLedger / setEoi / setPayItemMaterialStatus / setEoiApproval).
 */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { buildOverlaidDetail } from "@/data/seed/generate";
import { EOI_CODES, MOA_CODES, MATERIALS } from "@/data/reference";
import {
  INVENTORY_STATUSES,
  EOI_APPROVALS,
  LEDGER_TYPES,
  PAY_ITEM_MATERIAL_STATUSES,
  type EOIEntry,
  type LedgerEntry,
  type InventoryDetail,
  type PayItem,
} from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import {
  EditableRowTable,
  EditText,
  EditNumber,
  EditDate,
  EditSelect,
  EditChips,
  type EditableColumn,
} from "@/components/ui/EditableRowTable";
import { inventoryTone, eoiTone, payItemTone, groupTone } from "@/domain/status";
import { formatDate, formatQty, formatNumber } from "@/lib/format";

const TABS = ["Details", "Quantity Ledger", "Evidence of Inspection", "Pay Item Materials"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_PAY_ITEMS: never[] = [];

export function ItemDetailDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId));
  const payItems = useStore((s) => (item ? s.payItemsFor(item.contractId) : EMPTY_PAY_ITEMS));
  const eoiDeltas = useStore((s) => s.eoiDeltas);
  const ledgerDeltas = useStore((s) => s.ledgerDeltas);
  const eoiRowDeltas = useStore((s) => s.eoiRowDeltas);
  const payItemStatusDeltas = useStore((s) => s.payItemStatusDeltas);
  const setInventoryStatus = useStore((s) => s.setInventoryStatus);
  const canEdit = useStore((s) => s.can("create_inventory"));
  const [tab, setTab] = useState<Tab>("Details");
  const [editing, setEditing] = useState(false);

  const detail = useMemo<InventoryDetail | undefined>(() => {
    if (!item) return undefined;
    return buildOverlaidDetail(item, payItems, {
      eoiApproval: eoiDeltas,
      ledger: ledgerDeltas,
      eoiRows: eoiRowDeltas,
      payItemStatus: payItemStatusDeltas,
    });
  }, [item, payItems, eoiDeltas, ledgerDeltas, eoiRowDeltas, payItemStatusDeltas]);

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
    <>
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
        actions={<StatusControl itemId={item.id} status={item.status} detail={detail} onChange={setInventoryStatus} />}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onClose={onClose}
      >
        {tab === "Details" && <DetailsTab detail={detail} canEdit={canEdit} onEdit={() => setEditing(true)} />}
        {tab === "Quantity Ledger" && <LedgerTab detail={detail} itemId={itemId} payItems={payItems} canEdit={canEdit} />}
        {tab === "Evidence of Inspection" && <EOITab detail={detail} itemId={itemId} canEdit={canEdit} />}
        {tab === "Pay Item Materials" && <PayItemTab detail={detail} itemId={itemId} />}
      </DetailDrawer>

      {editing && (
        <InventoryForm
          contractId={item.contractId}
          item={item}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </>
  );
}

// --- Status control (Review Complete blocked until all EOI approved) --------

function StatusControl({
  itemId,
  status,
  detail,
  onChange,
}: {
  itemId: string;
  status: InventoryDetail["status"];
  detail: InventoryDetail;
  onChange: (ids: string[], status: InventoryDetail["status"], opts?: { note?: string }) => void;
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
          if (next === "Needs Attention") {
            onChange([itemId], next, { note: "Bounced back to author — needs attention." });
          } else {
            onChange([itemId], next);
          }
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent"
      >
        {INVENTORY_STATUSES.map((s) => (
          <option key={s} value={s} disabled={s === "Review Complete" && blockComplete}>
            {s}
          </option>
        ))}
      </select>
      {blockComplete && <span className="text-[10px] text-amber-700">{unresolved} EOI unreviewed</span>}
    </div>
  );
}

// --- Details ---------------------------------------------------------------

function DetailsTab({ detail, canEdit, onEdit }: { detail: InventoryDetail; canEdit: boolean; onEdit: () => void }) {
  const setNote = useStore((s) => s.setInventoryNote);
  const [note, setLocalNote] = useState(detail.note);
  useEffect(() => setLocalNote(detail.note), [detail.id, detail.note]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {canEdit && (
          <button onClick={onEdit} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-canvas">
            Edit details
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Material Code" value={detail.materialCode} mono />
        <Field label="Material Name" value={detail.materialName} />
        <Field label="Material Unit of Measure" value={detail.materialUnit} />
        <Field label="Inventory ID" value={detail.inventoryId} mono />
        <Field label="Producer Number" value={detail.producerNumber} mono />
        <Field label="Producer Name" value={detail.producerName} />
        <Field label="Supplier Number" value={detail.supplierNumber} mono />
        <Field label="Supplier Name" value={detail.supplierName} />
        {detail.locationType && <Field label="Location Type" value={detail.locationType} />}
        {detail.effectiveDate && <Field label="Effective Date" value={formatDate(detail.effectiveDate)} />}
        {detail.expirationDate && <Field label="Expiration Date" value={formatDate(detail.expirationDate)} />}
        <Field label="Contract Number" value={detail.contractNumber} mono hint="read-only" />
        <Field label="Linked Pay Items" value={detail.payItemNumbers.join(", ") || "—"} mono />
      </div>

      <MaterialSpec materialCode={detail.materialCode} />

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Inventory Note</label>
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

// Real CMMS Part 3 material spec (brief 14) — read off the material definition.
function MaterialSpec({ materialCode }: { materialCode: string }) {
  const material = MATERIALS.find((m) => m.code === materialCode);
  if (!material) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Material Specification (Material Definition)
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Method of Acceptance (MOA)" value={material.moa || "—"} />
        <Field label="Acceptable EOI" value={material.acceptableEoi.join(" · ") || "—"} mono />
        {material.babaDsa && <Field label="BABA / DSA" value={material.babaDsa} />}
        {material.sampleSize && <Field label="Sample Size" value={material.sampleSize} />}
        {material.specifications && <Field label="Specifications" value={material.specifications} />}
        {material.group && <Field label="Material Group" value={material.group} />}
      </div>
    </div>
  );
}

function Field({ label, value, mono, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
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

// --- Quantity Ledger (writable) --------------------------------------------

function LedgerTab({
  detail,
  itemId,
  payItems,
  canEdit,
}: {
  detail: InventoryDetail;
  itemId: string;
  payItems: PayItem[];
  canEdit: boolean;
}) {
  const setLedger = useStore((s) => s.setLedger);
  const rows = detail.ledger;
  const received = rows.filter((l) => l.type === "Received").reduce((s, l) => s + l.transactionQty, 0);
  const payItemOptions = detail.payItemNumbers.length ? detail.payItemNumbers : payItems.map((p) => p.number);

  const commit = (next: LedgerEntry[]) => setLedger(itemId, next);
  const editRow = (id: string, patch: Partial<LedgerEntry>) =>
    commit(rows.map((r) => (String(r.id) === id ? { ...r, ...patch } : r)));
  const addRow = () => {
    const nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
    commit([
      ...rows,
      {
        id: nextId,
        date: new Date().toISOString().slice(0, 10),
        payItemNumber: payItemOptions[0] ?? "",
        desc1: "",
        desc2: "",
        desc3: "",
        mixDesign: "",
        batchLotHeat: "",
        type: "Received",
        transactionQty: 0,
      },
    ]);
  };

  const columns: EditableColumn<LedgerEntry>[] = [
    { key: "id", header: "Id", width: "50px", render: (r) => <span className="font-mono text-[13px]">{r.id}</span> },
    { key: "date", header: "Date", width: "140px", render: (r) => <EditDate value={r.date} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { date: v })} /> },
    { key: "payItem", header: "Pay Item", width: "minmax(120px,1fr)",
      render: (r) =>
        payItemOptions.length ? (
          <EditSelect value={r.payItemNumber || payItemOptions[0]} options={payItemOptions} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { payItemNumber: v })} />
        ) : (
          <EditText value={r.payItemNumber} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { payItemNumber: v })} />
        ) },
    { key: "desc1", header: "Desc 1", width: "minmax(90px,1fr)", render: (r) => <EditText value={r.desc1} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { desc1: v })} /> },
    { key: "desc2", header: "Desc 2", width: "minmax(90px,1fr)", render: (r) => <EditText value={r.desc2} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { desc2: v })} /> },
    { key: "mix", header: "Mix Design", width: "minmax(110px,1fr)", render: (r) => <EditText value={r.mixDesign} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { mixDesign: v })} /> },
    { key: "blh", header: "Batch/Lot/Heat", width: "minmax(120px,1fr)", render: (r) => <EditText value={r.batchLotHeat} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { batchLotHeat: v })} /> },
    { key: "type", header: "Type", width: "130px", render: (r) => <EditSelect value={r.type} options={LEDGER_TYPES} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { type: v })} /> },
    {
      key: "qty",
      header: "Trans. Qty",
      width: "110px",
      align: "right",
      render: (r) => <EditNumber value={r.transactionQty} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { transactionQty: v })} />,
      footer: () => `${formatNumber(received, 2)}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm">
        <span className="text-ink-soft">Ledger summary</span>
        <span className="font-semibold text-ink">{formatQty(received, detail.materialUnit)} received</span>
        <span className="text-ink-faint">· {rows.length} entries · Material Unit {detail.materialUnit}</span>
      </div>
      <EditableRowTable
        rows={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        onEdit={(id, patch) => editRow(id, patch)}
        onAdd={canEdit ? addRow : undefined}
        onDelete={canEdit ? (id) => commit(rows.filter((r) => String(r.id) !== id)) : undefined}
        addLabel="+ Add ledger row"
        readOnly={!canEdit}
        emptyMessage="No ledger entries yet."
      />
    </div>
  );
}

// --- Evidence of Inspection (writable + approvable) ------------------------

function EOITab({ detail, itemId, canEdit }: { detail: InventoryDetail; itemId: string; canEdit: boolean }) {
  const setEoi = useStore((s) => s.setEoi);
  const samplesList = useStore((s) => s.samplesList);
  const rows = detail.eoi;
  const ledgerIds = detail.ledger.map((l) => l.id);
  // approved Test IDs from samples linked to this inventory (brief 04 → 05)
  const approvedTestIds = useMemo(
    () => samplesList.filter((s) => s.inventoryItemId === itemId && s.status === "Approved").map((s) => s.testId),
    [samplesList, itemId],
  );

  const commit = (next: EOIEntry[]) => setEoi(itemId, next);
  const editRow = (id: string, patch: Partial<EOIEntry>) => commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => {
    commit([
      ...rows,
      {
        id: `${itemId}_eoi_new_${Date.now()}`,
        ledgerIds: ledgerIds.length ? [ledgerIds[0]] : [],
        actualEoi: [],
        actualMoa: [],
        testId: "",
        approval: "Unset",
        note: "",
        hasDocument: false,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Every Ledger ID row needs approval before the inventory can be completed. Approved · Approved as
        Exception · Rejected (a note is required for exceptions and rejections).
      </p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <EOIRow
            key={row.id}
            row={row}
            itemId={itemId}
            ledgerIds={ledgerIds}
            approvedTestIds={approvedTestIds}
            canEdit={canEdit}
            onEditRow={editRow}
            onDelete={canEdit ? () => commit(rows.filter((r) => r.id !== row.id)) : undefined}
          />
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-soft">No EOI rows yet.</p>}
      </div>
      {canEdit && (
        <button
          onClick={addRow}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-soft"
        >
          + Add EOI row
        </button>
      )}
    </div>
  );
}

function EOIRow({
  row,
  itemId,
  ledgerIds,
  approvedTestIds,
  canEdit,
  onEditRow,
  onDelete,
}: {
  row: EOIEntry;
  itemId: string;
  ledgerIds: number[];
  approvedTestIds: string[];
  canEdit: boolean;
  onEditRow: (id: string, patch: Partial<EOIEntry>) => void;
  onDelete?: () => void;
}) {
  const setApproval = useStore((s) => s.setEoiApproval);
  const canApprove = useStore((s) => s.can("approve_eoi"));
  const [note, setNote] = useState(row.note);
  useEffect(() => setNote(row.note), [row.id, row.note]);
  const needsNote = row.approval === "Approved as Exception" || row.approval === "Rejected";

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-sm">
        <Meta label="Ledger IDs">
          <EditChips
            selected={row.ledgerIds.map(String)}
            options={ledgerIds.map(String)}
            disabled={!canEdit}
            onToggle={(next) => onEditRow(row.id, { ledgerIds: next.map(Number) })}
          />
        </Meta>
        <Meta label="Actual EOI">
          <EditChips selected={row.actualEoi} options={EOI_CODES} disabled={!canEdit} onToggle={(next) => onEditRow(row.id, { actualEoi: next })} />
        </Meta>
        <Meta label="MOA">
          <EditChips selected={row.actualMoa} options={MOA_CODES} disabled={!canEdit} onToggle={(next) => onEditRow(row.id, { actualMoa: next })} />
        </Meta>
        <Meta label="Test ID">
          {approvedTestIds.length > 0 ? (
            <select
              value={row.testId}
              disabled={!canEdit}
              onChange={(e) => onEditRow(row.id, { testId: e.target.value })}
              className="rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60"
            >
              <option value="">—</option>
              {approvedTestIds.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              {row.testId && !approvedTestIds.includes(row.testId) && <option value={row.testId}>{row.testId}</option>}
            </select>
          ) : (
            <span className="font-mono">{row.testId || "—"}</span>
          )}
        </Meta>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-accent" checked={row.hasDocument} disabled={!canEdit} onChange={(e) => onEditRow(row.id, { hasDocument: e.target.checked })} />
          📎 Doc
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Pill tone={eoiTone(row.approval)}>{row.approval === "Unset" ? "Not reviewed" : row.approval}</Pill>
          {onDelete && (
            <button onClick={onDelete} className="rounded-md px-2 py-0.5 text-xs text-ink-faint hover:bg-red-50 hover:text-red-700">Remove</button>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {EOI_APPROVALS.map((a) => (
          <button
            key={a}
            disabled={!canApprove}
            title={canApprove ? undefined : "Approval is documentation-only."}
            onClick={() => setApproval(itemId, row.id, a, note)}
            className={[
              "rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
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
        {row.approval !== "Unset" && canApprove && (
          <button onClick={() => setApproval(itemId, row.id, "Unset", "")} className="rounded-md px-2 py-1 text-xs text-ink-faint hover:bg-canvas">
            Reset
          </button>
        )}
      </div>

      {needsNote && (
        <input
          value={note}
          disabled={!canApprove}
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

// --- Pay Item Materials (status setter) ------------------------------------

function PayItemTab({ detail, itemId }: { detail: InventoryDetail; itemId: string }) {
  const setStatus = useStore((s) => s.setPayItemMaterialStatus);
  const canSetStatus = useStore((s) => s.can("set_pay_item_material_status"));
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
            <Metric label="Balance" value={`${r.balance >= 0 ? "+" : ""}${formatNumber(r.balance, 2)} ${r.materialUnit}`} tone={r.balance >= 0 ? "pos" : "neg"} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Group {r.group} Status</div>
              <Pill tone={groupTone(r.groupStatus)}>{r.groupStatus}</Pill>
            </div>
          </div>
          <div className="mt-2 text-xs text-ink-faint">
            Pay quantity placed {formatNumber(r.placedQuantity)} {r.payItemUnit} · conversion factor {r.conversionFactor}
            <span className="ml-1 text-amber-700">· material unit {r.materialUnit} ≠ pay unit {r.payItemUnit || "—"}</span>
          </div>

          {canSetStatus && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
              <span className="text-xs text-ink-soft">Set Pay Item Material Status:</span>
              {PAY_ITEM_MATERIAL_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    if (st === "Approved as Exception" || st === "Deficient") {
                      const note = window.prompt(`Note for "${st}":`) ?? "";
                      if (!note.trim()) return;
                      setStatus(itemId, r.payItemNumber, st, note.trim());
                    } else {
                      setStatus(itemId, r.payItemNumber, st);
                    }
                  }}
                  className={[
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                    r.payItemMaterialStatus === st ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas",
                  ].join(" ")}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
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
      <div className={["font-medium tabular-nums", tone === "pos" ? "text-green-700" : tone === "neg" ? "text-red-700" : "text-ink"].join(" ")}>
        {value}
      </div>
    </div>
  );
}
