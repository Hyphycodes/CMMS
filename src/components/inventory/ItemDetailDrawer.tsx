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
import { canMarkReviewComplete, unresolvedEoiCount } from "@/domain/rules";
import { descriptorLabelsFor } from "@/domain/descriptors";
import { FileDrop } from "@/components/ui/FileDrop";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import {
  EditText,
  EditNumber,
  EditDate,
  EditSelect,
  EditChips,
} from "@/components/ui/EditableRowTable";
import { inventoryTone, eoiTone, payItemTone, groupTone, isTestEditable } from "@/domain/status";
import { formatDate, formatQty, formatNumber } from "@/lib/format";

const TABS = ["Details", "Quantity Ledger", "Evidence of Inspection", "Pay Item Materials", "History"] as const;
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
            <Pill tone={inventoryTone(item.status)}>{item.status ?? "No status"}</Pill>
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
        {tab === "Details" && <DetailsTab detail={detail} canEdit={canEdit} onEdit={() => setEditing(true)} onGoToPayItems={() => setTab("Pay Item Materials")} />}
        {tab === "Quantity Ledger" && <LedgerTab detail={detail} itemId={itemId} payItems={payItems} canEdit={canEdit} />}
        {tab === "Evidence of Inspection" && <EOITab detail={detail} itemId={itemId} canEdit={canEdit} />}
        {tab === "Pay Item Materials" && <PayItemTab detail={detail} itemId={itemId} />}
        {tab === "History" && (
          <div className="space-y-2">
            <p className="text-xs text-ink-faint">Append-only change history for this inventory record (P4).</p>
            <HistoryPanel entity="inventoryItem" entityId={itemId} />
          </div>
        )}
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
        value={status ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (raw === "" ? null : raw) as InventoryDetail["status"];
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
        {/* legacy allows a blank Inventory Status (brief 16) */}
        <option value="">— No status —</option>
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

function DetailsTab({
  detail,
  canEdit,
  onEdit,
  onGoToPayItems,
}: {
  detail: InventoryDetail;
  canEdit: boolean;
  onEdit: () => void;
  onGoToPayItems: () => void;
}) {
  const setNote = useStore((s) => s.setInventoryNote);
  const setActive = useStore((s) => s.setInventoryActive);
  const [note, setLocalNote] = useState(detail.note);
  useEffect(() => setLocalNote(detail.note), [detail.id, detail.note]);

  const active = detail.active !== false; // undefined ⇒ active
  // Quantity-ledger Rec/Adj total (legacy summary line above the grid).
  const ledgerTotal = detail.ledger
    .filter((l) => l.type === "Received" || l.type === "Adjustment")
    .reduce((s, l) => s + l.transactionQty, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <Field label="Inventory Status" value={detail.status ?? "—"} />
          <Field label="Location Type" value={detail.locationType || "—"} hint="synced" />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Active</span>
            <button
              role="switch"
              aria-checked={active}
              disabled={!canEdit}
              onClick={() => setActive(detail.id, !active)}
              className={`relative h-5 w-9 rounded-full transition ${active ? "bg-accent" : "bg-line-strong"} disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${active ? "left-[18px]" : "left-0.5"}`} />
            </button>
            <span className="text-xs text-ink-soft">{active ? "Active" : "Inactive"}</span>
          </label>
        </div>
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
        {detail.effectiveDate && <Field label="Effective Date" value={formatDate(detail.effectiveDate)} />}
        {detail.expirationDate && <Field label="Expiration Date" value={formatDate(detail.expirationDate)} />}
        <Field label="Contract Number" value={detail.contractNumber} mono hint="read-only" />
      </div>

      {/* Pay-item association grid (legacy Details tab, brief 16) */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Pay Item Associations</div>
          <div className="text-xs text-ink-soft">
            Total Qty: <span className="font-medium tabular-nums">{formatNumber(ledgerTotal, 4)}</span> · Material Unit:{" "}
            <span className="font-medium">{detail.materialUnit}</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 font-semibold">Pay Item</th>
                <th className="px-3 py-2 text-right font-semibold">Material Rec/Adj Quantity</th>
                <th className="px-3 py-2 text-center font-semibold">Item Association Status</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {detail.payItemMaterials.map((r) => {
                const approved = r.payItemMaterialStatus === "Approved" || r.payItemMaterialStatus === "Approved as Exception";
                return (
                  <tr key={r.payItemNumber} className="border-t border-line">
                    <td className="px-3 py-2">
                      <span className="font-mono font-medium">{r.payItemNumber}</span>
                      <span className="ml-2 text-ink-soft">{r.payItemDescription}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.materialQuantityProvided, 4)}</td>
                    <td className="px-3 py-2 text-center">
                      {approved ? (
                        <span className="font-semibold text-green-600" title={r.payItemMaterialStatus}>✓</span>
                      ) : (
                        <span className="font-semibold text-red-600" title={r.payItemMaterialStatus}>✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={onGoToPayItems} className="text-xs font-medium text-accent hover:underline">
                        Go to →
                      </button>
                    </td>
                  </tr>
                );
              })}
              {detail.payItemMaterials.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-ink-faint">No pay items associated.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const commit = (next: LedgerEntry[]) => setLedger(itemId, next);
  const editRow = (id: string, patch: Partial<LedgerEntry>) =>
    commit(rows.map((r) => (String(r.id) === id ? { ...r, ...patch } : r)));
  const makeRow = (): LedgerEntry => ({
    id: rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1,
    date: new Date().toISOString().slice(0, 10),
    payItemNumber: payItemOptions[0] ?? "",
    desc1: "",
    desc2: "",
    desc3: "",
    mixDesign: "",
    batchLotHeat: "",
    type: "Received",
    transactionQty: 0,
  });
  const addRow = () => commit([...rows, makeRow()]);
  // Right-click "Add row here" — insert directly after the targeted row (brief 21).
  const addRowAfter = (id: string) => {
    const idx = rows.findIndex((r) => String(r.id) === id);
    const next = rows.slice();
    next.splice(idx + 1, 0, makeRow());
    commit(next);
  };
  const deleteRow = (id: string) => commit(rows.filter((r) => String(r.id) !== id));

  // Brief 24 — material-specific descriptor column labels (Color / Type of
  // Sheeting / …) driven off the material's family descriptor schema.
  const material = MATERIALS.find((m) => m.code === detail.materialCode);
  const [d1Label, d2Label, d3Label] = descriptorLabelsFor(material?.family);

  // Inventory Quantity by Description rollup (brief 24) — group ledger rows by
  // their descriptor tuple and sum the transaction quantity.
  const byDescription = useMemo(() => {
    const map = new Map<string, { desc1: string; desc2: string; desc3: string; qty: number }>();
    for (const r of rows) {
      const key = `${r.desc1}|${r.desc2}|${r.desc3}`;
      const e = map.get(key) ?? { desc1: r.desc1, desc2: r.desc2, desc3: r.desc3, qty: 0 };
      e.qty += r.transactionQty;
      map.set(key, e);
    }
    return [...map.values()];
  }, [rows]);

  // Fitted grid: identity (Id) is frozen left; flexible text columns shrink so
  // all columns fit within the drawer at desktop width — no horizontal scroll.
  const template =
    "44px 120px minmax(0,1.1fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.05fr) 104px 90px" +
    (canEdit ? " 64px" : "");
  const headers = ["Id", "Date", "Pay Item", d1Label, d2Label, d3Label, "Mix Design", "Batch/Lot/Heat", "Type", "Trans. Qty"];

  const stickyId = "sticky left-0 z-10 bg-surface";
  const stickyIdHead = "sticky left-0 z-10 bg-canvas";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm">
        <span className="text-ink-soft">Ledger summary</span>
        <span className="font-semibold text-ink">{formatQty(received, detail.materialUnit)} received</span>
        <span className="text-ink-faint">· {rows.length} entries · Material Unit {detail.materialUnit || "—"}</span>
        {material?.specialId && <span className="text-ink-faint">· Special ID {material.specialId}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <div style={{ minWidth: 720 }}>
          {/* header */}
          <div
            className="grid items-center gap-2 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
            style={{ gridTemplateColumns: template }}
          >
            {headers.map((h, i) => (
              <span
                key={h}
                className={[i === 0 ? stickyIdHead : "", i === 9 ? "text-right" : "", "truncate"].join(" ")}
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
                onContextMenu={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, id: String(r.id) });
                }}
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
                <EditText value={r.desc3} disabled={!canEdit} onCommit={(v) => editRow(String(r.id), { desc3: v })} />
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
              <span className="col-span-8 text-ink-soft">Total received</span>
              <span className="text-right tabular-nums">{formatNumber(received, 2)}</span>
              {canEdit && <span />}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Quantity by Description rollup (brief 24) */}
      {byDescription.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Inventory Quantity by Description
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-1.5 font-semibold">{d1Label}</th>
                <th className="px-3 py-1.5 font-semibold">{d2Label}</th>
                <th className="px-3 py-1.5 font-semibold">{d3Label}</th>
                <th className="px-3 py-1.5 text-right font-semibold">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {byDescription.map((g, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-3 py-1.5">{g.desc1 || "—"}</td>
                  <td className="px-3 py-1.5">{g.desc2 || "—"}</td>
                  <td className="px-3 py-1.5">{g.desc3 || "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(g.qty, 2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line bg-canvas font-medium">
                <td className="px-3 py-1.5" colSpan={3}>Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(byDescription.reduce((s, g) => s + g.qty, 0), 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <button
          onClick={addRow}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-soft"
        >
          + Add ledger row
        </button>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Add row here", onClick: () => addRowAfter(menu.id) },
            { label: "Remove row", danger: true, onClick: () => deleteRow(menu.id) },
          ]}
        />
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
  // Brief 22 — Test IDs whose sample is decided (Approved/Rejected) lock the field.
  const lockedTestIds = useMemo(
    () => new Set(samplesList.filter((s) => !isTestEditable(s.status)).map((s) => s.testId)),
    [samplesList],
  );

  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const commit = (next: EOIEntry[]) => setEoi(itemId, next);
  const editRow = (id: string, patch: Partial<EOIEntry>) => commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const makeRow = (): EOIEntry => ({
    id: `${itemId}_eoi_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ledgerIds: ledgerIds.length ? [ledgerIds[0]] : [],
    actualEoi: [],
    actualMoa: [],
    testId: "",
    approval: "Unset",
    note: "",
    hasDocument: false,
  });
  const addRow = () => commit([...rows, makeRow()]);
  const addRowAfter = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    const next = rows.slice();
    next.splice(idx + 1, 0, makeRow());
    commit(next);
  };
  const deleteRow = (id: string) => commit(rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Every Ledger ID row needs approval before the inventory can be completed. Approved · Approved as
        Exception · Rejected (a note is required for exceptions and rejections). Right-click a row to add/remove.
      </p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.id}
            onContextMenu={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, id: row.id });
            }}
          >
            <EOIRow
              row={row}
              itemId={itemId}
              ledgerIds={ledgerIds}
              approvedTestIds={approvedTestIds}
              testIdLocked={!!row.testId && lockedTestIds.has(row.testId)}
              canEdit={canEdit}
              onEditRow={editRow}
              onDelete={canEdit ? () => deleteRow(row.id) : undefined}
            />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-soft">No EOI rows yet.</p>}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Add row here", onClick: () => addRowAfter(menu.id) },
            { label: "Remove row", danger: true, onClick: () => deleteRow(menu.id) },
          ]}
        />
      )}
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

// --- Document upload (real files via the S1 file seam) ---------------------

function EoiDocuments({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  return (
    <div className="border-t border-line pt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Documents</div>
      <FileDrop scope={{ entity: "inventoryDoc", entityId: itemId }} disabled={!canEdit} label="Add document" />
    </div>
  );
}

function EOIRow({
  row,
  itemId,
  ledgerIds,
  approvedTestIds,
  testIdLocked,
  canEdit,
  onEditRow,
  onDelete,
}: {
  row: EOIEntry;
  itemId: string;
  ledgerIds: number[];
  approvedTestIds: string[];
  testIdLocked: boolean;
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
            disabled={!canEdit || testIdLocked}
            title={testIdLocked ? "Locked — the linked sample has been approved/rejected" : undefined}
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
        <div className="min-w-[180px] flex-1">
          <FileDrop scope={{ entity: "eoi", entityId: `${itemId}:${row.id}` }} disabled={!canEdit} label="Attach doc" compact />
        </div>
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
