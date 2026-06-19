/**
 * Inventory detail (briefs 01 + 05). Read path unchanged in look; the Quantity
 * Ledger and Evidence of Inspection tabs are now writable, Pay Item Materials
 * carries the documentation-only status setter, and Review Complete is blocked
 * until every EOI row is approved. All writes go through optimistic store
 * mutations (setLedger / setEoi / setPayItemMaterialStatus / setEoiApproval).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/store";
import { buildOverlaidDetail } from "@/data/seed/generate";
import { EOI_CODES, MOA_CODES, MATERIALS } from "@/data/reference";
import { XIcon } from "@/components/ui/icons";
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
import { canMarkReviewComplete, unresolvedEoiCount } from "@/domain/rules";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import {
  EditText,
  EditNumber,
  EditDate,
  EditSelect,
  EditChips,
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
        width={1040}
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
  const unresolved = unresolvedEoiCount(detail);
  const blockComplete = !canMarkReviewComplete(detail);
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

  const deleteRow = (id: string) => commit(rows.filter((r) => String(r.id) !== id));

  // Fitted grid: identity (Id) is frozen left; flexible text columns shrink so
  // all columns fit within the drawer at desktop width — no horizontal scroll.
  const template =
    "44px 124px minmax(0,1.3fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.05fr) minmax(0,1.15fr) 112px 96px" +
    (canEdit ? " 64px" : "");
  const headers = ["Id", "Date", "Pay Item", "Desc 1", "Desc 2", "Mix Design", "Batch/Lot/Heat", "Type", "Trans. Qty"];

  const stickyId = "sticky left-0 z-10 bg-surface";
  const stickyIdHead = "sticky left-0 z-10 bg-canvas";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm">
        <span className="text-ink-soft">Ledger summary</span>
        <span className="font-semibold text-ink">{formatQty(received, detail.materialUnit)} received</span>
        <span className="text-ink-faint">· {rows.length} entries · Material Unit {detail.materialUnit || "—"}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <div style={{ minWidth: 640 }}>
          {/* header */}
          <div
            className="grid items-center gap-2 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
            style={{ gridTemplateColumns: template }}
          >
            {headers.map((h, i) => (
              <span
                key={h}
                className={[i === 0 ? stickyIdHead : "", i === 8 ? "text-right" : "", "truncate"].join(" ")}
              >
                {h}
              </span>
            ))}
            {canEdit && <span />}
          </div>

          {/* rows */}
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">No ledger entries yet.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="grid items-center gap-2 border-b border-line/70 px-3 py-1.5 text-sm last:border-b-0"
                style={{ gridTemplateColumns: template }}
              >
                <span className={[stickyId, "font-mono text-[13px] text-ink-faint"].join(" ")}>{r.id}</span>
                <EditDate value={r.date} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { date: v })} />
                {payItemOptions.length ? (
                  <EditSelect value={r.payItemNumber || payItemOptions[0]} options={payItemOptions} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { payItemNumber: v })} />
                ) : (
                  <EditText value={r.payItemNumber} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { payItemNumber: v })} />
                )}
                <EditText value={r.desc1} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { desc1: v })} />
                <EditText value={r.desc2} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { desc2: v })} />
                <EditText value={r.mixDesign} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { mixDesign: v })} />
                <EditText value={r.batchLotHeat} disabled={!canEdit} mono onCommit={(v) => editRow(String(r.id), { batchLotHeat: v })} />
                <EditSelect value={r.type} options={LEDGER_TYPES} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { type: v })} />
                <EditNumber value={r.transactionQty} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { transactionQty: v })} />
                {canEdit && (
                  <button
                    onClick={() => deleteRow(String(r.id))}
                    className="rounded-md px-2 py-1 text-xs text-ink-faint transition hover:bg-red-50 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}

          {/* totals — distinct from the rows */}
          {rows.length > 0 && (
            <div
              className="grid items-center gap-2 border-t-2 border-line bg-canvas px-3 py-2 text-sm font-medium text-ink"
              style={{ gridTemplateColumns: template }}
            >
              <span className={stickyId.replace("bg-surface", "bg-canvas")} />
              <span className="col-span-7 text-ink-soft">Total received</span>
              <span className="text-right tabular-nums">{formatNumber(received, 2)}</span>
              {canEdit && <span />}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <button
          onClick={addRow}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-soft"
        >
          + Add ledger row
        </button>
      )}
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

      <EoiDocuments itemId={itemId} canEdit={canEdit} />
    </div>
  );
}

// --- Document upload (persisted against the inventory item) ----------------

const EMPTY_DOCS: never[] = [];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EoiDocuments({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  const docs = useStore((s) => s.inventoryDocs[itemId] ?? EMPTY_DOCS);
  const addDocs = useStore((s) => s.addInventoryDocs);
  const removeDoc = useStore((s) => s.removeInventoryDoc);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const ingest = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addDocs(
      itemId,
      Array.from(files).map((f) => ({
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size,
        mimeType: f.type,
        url: URL.createObjectURL(f),
        addedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      })),
    );
  };

  return (
    <div className="border-t border-line pt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Documents</div>

      {docs.length > 0 && (
        <div className="mb-3 space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2">
              <span className="text-lg">📄</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{d.name}</div>
                <div className="text-xs text-ink-faint">
                  {formatBytes(d.size)}
                  {d.mimeType ? ` · ${d.mimeType}` : ""} · Added {d.addedAt}
                </div>
              </div>
              <a href={d.url} download={d.name} className="shrink-0 text-xs font-medium text-accent hover:underline">
                Download
              </a>
              {canEdit && (
                <button
                  onClick={() => removeDoc(itemId, d.id)}
                  title="Remove"
                  className="shrink-0 rounded p-0.5 text-ink-faint transition hover:text-red-600"
                >
                  <XIcon className="text-base" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              ingest(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              ingest(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition select-none",
              dragging ? "border-accent bg-accent/5" : "border-line hover:border-accent/60 hover:bg-canvas",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-ink">Add document</span>
            <span className="text-xs text-ink-faint">Click to browse or drag and drop — PDF or images</span>
          </div>
        </>
      )}

      {!canEdit && docs.length === 0 && <p className="text-sm text-ink-faint">No documents uploaded.</p>}
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
          {/* inline-editable: free text + autocomplete of approved Test IDs */}
          <input
            key={row.testId}
            defaultValue={row.testId}
            disabled={!canEdit}
            list={approvedTestIds.length ? `tid-${row.id}` : undefined}
            placeholder="—"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== row.testId) onEditRow(row.id, { testId: v });
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-28 rounded-md border border-line bg-surface px-2 py-1 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
          />
          {approvedTestIds.length > 0 && (
            <datalist id={`tid-${row.id}`}>
              {approvedTestIds.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
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
