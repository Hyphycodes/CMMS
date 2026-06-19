/**
 * Quantity Book (brief 08). Pay item list + three tabs: Pay Item Entry
 * (placements), Pay Item Materials (shared grouping.ts with inventory), and
 * Material Associations (Create → pre-linked inventory). Replaces the stub.
 */
import { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/store/store";
import { buildOverlaidDetail, buildMaterialAssociations } from "@/data/seed/generate";
import {
  PAY_ITEM_MATERIAL_STATUSES,
  type PayItem,
  type PlacementEntry,
  type MaterialAssociation,
} from "@/domain/types";
import { TabBar } from "@/components/ui/TabBar";
import { Pill } from "@/components/ui/Pill";
import { DataGrid } from "@/components/ui/DataGrid";
import {
  EditableRowTable,
  EditText,
  EditNumber,
  EditDate,
  EditSelect,
  type EditableColumn,
} from "@/components/ui/EditableRowTable";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { payItemTone, groupTone } from "@/domain/status";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { FUND_KEYS } from "@/config"; // IDOT-SPECIFIC — via the config boundary (F5)

const TABS = ["Pay Item Entry", "Pay Item Materials", "Material Associations"] as const;
type Tab = (typeof TABS)[number];

export function QuantityBookPage() {
  const { contractId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const contract = useStore((s) => s.contract(contractId));
  const canAccess = useStore((s) => s.canAccessContract(contractId));
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const payItems = useMemo(() => payItemsByContract.get(contractId) ?? [], [payItemsByContract, contractId]);
  // 16b — deep link from Inventory Details "Go to": ?payItem=<number> preselects.
  const [selected, setSelected] = useState<string>(searchParams.get("payItem") ?? "");
  const [tab, setTab] = useState<Tab>("Pay Item Entry");

  const current = payItems.find((p) => p.number === selected) ?? payItems[0];

  if (!contract) return <div className="grid h-full place-items-center text-ink-soft">Select a contract.</div>;
  if (!canAccess)
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">You don't have access to contract {contract.number}.</div>;

  return (
    <div className="flex h-full min-h-0">
      {/* pay item list */}
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h1 className="text-sm font-semibold text-ink">Quantity Book</h1>
          <p className="text-xs text-ink-soft">{payItems.length} pay items</p>
        </div>
        {payItems.map((p) => {
          const pct = p.awardedQuantity ? Math.round((p.placedQuantity / p.awardedQuantity) * 100) : 0;
          const active = current?.number === p.number;
          return (
            <button
              key={p.number}
              onClick={() => setSelected(p.number)}
              className={["block w-full border-b border-line/70 px-4 py-2.5 text-left transition", active ? "bg-accent-soft" : "hover:bg-canvas"].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold text-ink">{p.number}</span>
                {p.final && <Pill tone="green">Final</Pill>}
                {p.isSpecialtyItem && (
                  <span className="rounded border border-line px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    Specialty
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-ink-soft" title={p.description}>{p.description}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <span className="text-[11px] tabular-nums text-ink-faint">{pct}%</span>
              </div>
            </button>
          );
        })}
      </aside>

      {/* selected pay item */}
      <div className="flex min-h-0 flex-1 flex-col">
        {current ? (
          <>
            <div className="border-b border-line bg-surface px-5 pt-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-ink">{current.number}</span>
                <span className="text-sm text-ink">{current.description}</span>
              </div>
              <TabBar tabs={TABS.map((t) => ({ id: t, label: t }))} active={tab} onChange={setTab} className="mt-2" />
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
              {tab === "Pay Item Entry" && <PayItemEntry contractId={contractId} payItem={current} />}
              {tab === "Pay Item Materials" && <PayItemMaterials contractId={contractId} payItem={current} />}
              {tab === "Material Associations" && <MaterialAssociations contractId={contractId} payItem={current} />}
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-soft">This contract has no pay items.</div>
        )}
      </div>
    </div>
  );
}

function PayItemEntry({ contractId, payItem }: { contractId: string; payItem: PayItem }) {
  const placementsList = useStore((s) => s.placementsList);
  const savePlacement = useStore((s) => s.savePlacement);
  const deletePlacement = useStore((s) => s.deletePlacement);
  const finalizePayItem = useStore((s) => s.finalizePayItem);
  const canAuthor = useStore((s) => s.can("author_contract"));
  const currentUser = useStore((s) => s.currentUser);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const rows = useMemo(
    () => placementsList.filter((p) => p.contractId === contractId && p.payItemNumber === payItem.number),
    [placementsList, contractId, payItem.number],
  );
  const placedToDate = rows.filter((r) => r.type === "Placed").reduce((s, r) => s + r.quantity, 0);

  const edit = (id: string, patch: Partial<PlacementEntry>) => {
    const row = rows.find((r) => r.id === id);
    if (row) savePlacement({ ...row, ...patch });
  };
  const addRow = () =>
    savePlacement({
      id: `plc_new_${Date.now()}`,
      payItemNumber: payItem.number,
      contractId,
      date: new Date().toISOString().slice(0, 10),
      fundKey: payItem.fundKey ?? FUND_KEYS[0],
      type: "Placed",
      quantity: 0,
      price: payItem.unitPrice,
      location: "",
      contractor: "",
      posted: false,
      payEstimateId: null,
      creator: currentUser?.name ?? "",
    });

  const columns: EditableColumn<PlacementEntry>[] = [
    { key: "id", header: "Id", width: "70px", render: (r) => <span className="font-mono text-[12px]">{r.id.replace("plc_", "")}</span> },
    { key: "date", header: "Date", width: "140px", render: (r) => <EditDate value={r.date} disabled={!canAuthor} onCommit={(v) => edit(r.id, { date: v })} /> },
    { key: "fundKey", header: "Fund Key", width: "130px", render: (r) => <EditSelect value={(r.fundKey as (typeof FUND_KEYS)[number]) || FUND_KEYS[0]} options={FUND_KEYS} disabled={!canAuthor} onCommit={(v) => edit(r.id, { fundKey: v })} /> },
    { key: "type", header: "Type", width: "130px", render: (r) => <EditSelect value={r.type} options={["Placed", "Adjustment"] as const} disabled={!canAuthor} onCommit={(v) => edit(r.id, { type: v })} /> },
    { key: "quantity", header: "Quantity", width: "100px", align: "right", render: (r) => <EditNumber value={r.quantity} disabled={!canAuthor} onCommit={(v) => edit(r.id, { quantity: v })} />, footer: () => formatNumber(placedToDate, 0) },
    { key: "price", header: "Price", width: "100px", align: "right", render: (r) => <EditNumber value={r.price} disabled={!canAuthor} onCommit={(v) => edit(r.id, { price: v })} /> },
    { key: "location", header: "Location", width: "minmax(120px,1fr)", render: (r) => <EditText value={r.location} disabled={!canAuthor} onCommit={(v) => edit(r.id, { location: v })} /> },
    { key: "contractor", header: "Contractor", width: "minmax(120px,1fr)", render: (r) => <EditText value={r.contractor} disabled={!canAuthor} onCommit={(v) => edit(r.id, { contractor: v })} /> },
    { key: "posted", header: "Post", width: "70px", align: "center", render: (r) => <input type="checkbox" className="h-4 w-4 accent-accent" checked={r.posted} disabled={!canAuthor} onChange={(e) => edit(r.id, { posted: e.target.checked })} /> },
    { key: "payEst", header: "Pay Est", width: "100px", render: (r) => <span className="text-xs text-ink-faint">{r.payEstimateId ?? "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="text-sm font-semibold text-ink">Item Summary</span>
          {payItem.final && <Pill tone="green">Final</Pill>}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line px-4 py-3 text-sm sm:grid-cols-4">
          <Metric label="Contract Unit" value={payItem.unit} />
          <Metric label="Unit Price" value={formatMoney(payItem.unitPrice)} />
          <Metric label="Awarded Qty" value={`${formatNumber(payItem.awardedQuantity)} ${payItem.unit}`} />
          <Metric label="Placed to Date" value={`${formatNumber(placedToDate)} ${payItem.unit}`} />
          <Metric label="Fund Key" value={payItem.fundKey ?? "—"} />
          <Metric label="Associated Authorizations" value="see Authorizations" />
        </div>
      </section>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Placements</h3>
          {canAuthor && (
            <button
              onClick={() => finalizePayItem(contractId, payItem.number, !payItem.final)}
              className={["rounded-lg border px-3 py-1.5 text-sm font-medium transition", payItem.final ? "border-line text-ink-soft hover:bg-canvas" : "border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white"].join(" ")}
            >
              {payItem.final ? "Reopen pay item" : "Final a pay item"}
            </button>
          )}
        </div>
        <EditableRowTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          onEdit={edit}
          onAdd={canAuthor ? addRow : undefined}
          onDelete={canAuthor ? deletePlacement : undefined}
          onRowContextMenu={canAuthor ? (e, id) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id }); } : undefined}
          addLabel="+ Add placement"
          readOnly={!canAuthor}
          emptyMessage="No placements recorded."
        />
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Add placement here", onClick: addRow },
            { label: "Remove placement", danger: true, onClick: () => deletePlacement(menu.id) },
          ]}
        />
      )}
    </div>
  );
}

function PayItemMaterials({ contractId, payItem }: { contractId: string; payItem: PayItem }) {
  const items = useStore((s) => s.items);
  const eoiDeltas = useStore((s) => s.eoiDeltas);
  const ledgerDeltas = useStore((s) => s.ledgerDeltas);
  const eoiRowDeltas = useStore((s) => s.eoiRowDeltas);
  const payItemStatusDeltas = useStore((s) => s.payItemStatusDeltas);
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const setPayItemMaterialStatus = useStore((s) => s.setPayItemMaterialStatus);
  const canSetStatus = useStore((s) => s.can("set_pay_item_material_status"));

  const rows = useMemo(() => {
    const payItems = payItemsByContract.get(contractId) ?? [];
    const linked = items.filter((i) => i.contractId === contractId && i.payItemNumbers.includes(payItem.number));
    return linked.map((item) => {
      const detail = buildOverlaidDetail(item, payItems, { eoiApproval: eoiDeltas, ledger: ledgerDeltas, eoiRows: eoiRowDeltas, payItemStatus: payItemStatusDeltas });
      const row = detail.payItemMaterials.find((r) => r.payItemNumber === payItem.number);
      return { item, row };
    }).filter((x) => x.row);
  }, [items, contractId, payItem.number, payItemsByContract, eoiDeltas, ledgerDeltas, eoiRowDeltas, payItemStatusDeltas]);

  const totalProvided = rows.reduce((s, r) => s + (r.row?.materialQuantityProvided ?? 0), 0);

  if (rows.length === 0) {
    return <p className="text-sm text-ink-soft">No inventory is assigned to this pay item yet. Use Material Associations → Create.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 rounded-card border border-line bg-surface px-4 py-3 text-sm">
        <Metric label="Assignments" value={String(rows.length)} />
        <Metric label="Material Provided" value={formatNumber(totalProvided, 2)} />
        <Metric label="Pay Qty Placed" value={`${formatNumber(payItem.placedQuantity)} ${payItem.unit}`} />
      </div>
      <div className="space-y-2">
        {rows.map(({ item, row }) => row && (
          <div key={item.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-ink">PI Inv Group {row.group}</span>
              <span className="text-sm text-ink">{item.materialCode} — {item.materialName}</span>
              <span className="ml-auto"><Pill tone={payItemTone(row.payItemMaterialStatus)}>{row.payItemMaterialStatus}</Pill></span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
              <Metric label="Provided" value={`${formatNumber(row.materialQuantityProvided, 2)} ${row.materialUnit}`} />
              <Metric label="UOM" value={row.materialUnit} />
              <Metric label="Conversion" value={String(row.conversionFactor)} />
              <Metric label="Required" value={`${formatNumber(row.materialQuantityRequired, 2)} ${row.materialUnit}`} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Balance</div>
                <Pill tone={groupTone(row.groupStatus)}>{row.groupStatus}</Pill>
              </div>
            </div>
            {canSetStatus && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <span className="text-xs text-ink-soft">Pay Item Material Status:</span>
                {PAY_ITEM_MATERIAL_STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      if (st !== "Approved") {
                        const note = window.prompt(`Note for "${st}":`) ?? "";
                        if (!note.trim()) return;
                        setPayItemMaterialStatus(item.id, payItem.number, st, note.trim());
                      } else setPayItemMaterialStatus(item.id, payItem.number, st);
                    }}
                    className={["rounded-md border px-2.5 py-1 text-xs font-medium transition", row.payItemMaterialStatus === st ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas"].join(" ")}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialAssociations({ contractId, payItem }: { contractId: string; payItem: PayItem }) {
  const navigate = useNavigate();
  // Real association model (brief 17): Primary/Component, conversion, effective/expiration.
  const associated = useMemo(() => buildMaterialAssociations(payItem.number), [payItem.number]);

  const columns = [
    { id: "code", accessorKey: "materialCode", header: "Material Code", size: 120, cell: ({ row }: { row: { original: MaterialAssociation } }) => <span className="font-mono text-[13px] font-semibold">{row.original.materialCode}</span> },
    { id: "name", accessorKey: "materialName", header: "Material Name", size: 220, meta: { grow: true } },
    {
      id: "type",
      accessorFn: (m: MaterialAssociation) => m.materialType,
      header: "Material Type",
      size: 120,
      cell: ({ row }: { row: { original: MaterialAssociation } }) => (
        <Pill tone={row.original.materialType === "Primary" ? "blue" : "slate"}>{row.original.materialType}</Pill>
      ),
    },
    { id: "conversion", accessorFn: (m: MaterialAssociation) => m.conversionFactor, header: "Conversion", size: 100, meta: { align: "right" as const } },
    { id: "uom", accessorKey: "unit", header: "UOM", size: 80 },
    { id: "effective", accessorFn: (m: MaterialAssociation) => m.effectiveDate, header: "Effective Date", size: 130, cell: ({ row }: { row: { original: MaterialAssociation } }) => formatDate(row.original.effectiveDate) },
    { id: "expiration", accessorFn: (m: MaterialAssociation) => m.expirationDate, header: "Expiration Date", size: 130, cell: ({ row }: { row: { original: MaterialAssociation } }) => formatDate(row.original.expirationDate) },
    {
      id: "inventory",
      accessorFn: () => "",
      header: "Inventory",
      size: 110,
      cell: ({ row }: { row: { original: MaterialAssociation } }) => (
        <button
          onClick={() => navigate(`/contract/${contractId}/inventory?new=1&material=${row.original.materialCode}&payItem=${payItem.number}`)}
          className="rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
        >
          Create
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">Materials associated with this pay item ({associated.length}). Create spins up an inventory pre-linked to {payItem.number}.</p>
      <div className="h-[440px]">
        <DataGrid data={associated} columns={columns} getRowId={(m) => m.materialCode} emptyMessage="No associated materials." />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-medium tabular-nums text-ink">{value}</div>
    </div>
  );
}
