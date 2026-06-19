/**
 * M1 — Material Allowance (manual Ch. 5). Contract-scoped allowance lines
 * (material, quantity, unit price, allowance amount) that flow into Pay
 * Estimates. Editable rows with right-click add/remove and optimistic persist.
 */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import type { MaterialAllowanceLine } from "@/domain/types";
import { EditableRowTable, EditText, EditNumber, EditDate, type EditableColumn } from "@/components/ui/EditableRowTable";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { MATERIALS } from "@/data/reference";
import { formatMoney, formatNumber } from "@/lib/format";

export function MaterialAllowancePage() {
  const { contractId = "" } = useParams();
  const contract = useStore((s) => s.contract(contractId));
  const canAccess = useStore((s) => s.canAccessContract(contractId));
  const canEdit = useStore((s) => s.can("author_contract"));
  const all = useStore((s) => s.materialAllowancesList);
  const setLines = useStore((s) => s.setMaterialAllowances);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [picking, setPicking] = useState(false);

  const lines = useMemo(() => all.filter((l) => l.contractId === contractId), [all, contractId]);
  const total = lines.reduce((s, l) => s + l.allowanceAmount, 0);

  const commit = (next: MaterialAllowanceLine[]) => setLines(contractId, next);
  const edit = (id: string, patch: Partial<MaterialAllowanceLine>) =>
    commit(
      lines.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...patch };
        merged.allowanceAmount = Math.round(merged.quantity * merged.unitPrice * 100) / 100;
        return merged;
      }),
    );
  const addLine = (materialCode = "", materialName = "", unit = "Each") =>
    commit([
      ...lines,
      {
        id: `ma_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        contractId,
        materialCode,
        materialName,
        payItemNumber: "",
        quantity: 0,
        unit,
        unitPrice: 0,
        allowanceAmount: 0,
        invoiceNumber: "",
        receivedDate: null,
        note: "",
      },
    ]);
  const remove = (id: string) => commit(lines.filter((l) => l.id !== id));

  if (!contract) return <div className="grid h-full place-items-center text-ink-soft">Select a contract.</div>;
  if (!canAccess) return <div className="grid h-full place-items-center text-sm text-ink-soft">No access to {contract.number}.</div>;

  const columns: EditableColumn<MaterialAllowanceLine>[] = [
    { key: "materialCode", header: "Material", width: "minmax(0,1.4fr)", render: (l) => (
      <div className="leading-tight">
        <span className="font-mono text-[12px] font-semibold">{l.materialCode || "—"}</span>
        <div className="truncate text-[11px] text-ink-faint">{l.materialName}</div>
      </div>
    ) },
    { key: "payItemNumber", header: "Pay Item", width: "120px", render: (l) => <EditText value={l.payItemNumber} disabled={!canEdit} mono onCommit={(v) => edit(l.id, { payItemNumber: v })} /> },
    { key: "quantity", header: "Quantity", width: "100px", align: "right", render: (l) => <EditNumber value={l.quantity} disabled={!canEdit} onCommit={(v) => edit(l.id, { quantity: v })} />, footer: () => formatNumber(lines.reduce((s, l) => s + l.quantity, 0), 0) },
    { key: "unit", header: "Unit", width: "80px", render: (l) => <EditText value={l.unit} disabled={!canEdit} onCommit={(v) => edit(l.id, { unit: v })} /> },
    { key: "unitPrice", header: "Unit Price", width: "110px", align: "right", render: (l) => <EditNumber value={l.unitPrice} disabled={!canEdit} onCommit={(v) => edit(l.id, { unitPrice: v })} /> },
    { key: "allowanceAmount", header: "Allowance", width: "120px", align: "right", render: (l) => <span className="tabular-nums">{formatMoney(l.allowanceAmount)}</span>, footer: () => formatMoney(total) },
    { key: "invoiceNumber", header: "Invoice", width: "110px", render: (l) => <EditText value={l.invoiceNumber} disabled={!canEdit} onCommit={(v) => edit(l.id, { invoiceNumber: v })} /> },
    { key: "receivedDate", header: "Received", width: "140px", render: (l) => <EditDate value={l.receivedDate ?? ""} disabled={!canEdit} onCommit={(v) => edit(l.id, { receivedDate: v || null })} /> },
  ];

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">Material Allowance</h1>
            <p className="text-sm text-ink-soft">Stockpiled-material allowance lines (Ch. 5) that flow into Pay Estimates.</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Total Allowance</div>
            <div className="text-lg font-bold tabular-nums text-ink">{formatMoney(total)}</div>
          </div>
        </div>

        {canEdit && (
          <div className="relative inline-block">
            <button onClick={() => setPicking((v) => !v)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">+ Add from material</button>
            {picking && (
              <div className="absolute z-20 mt-1 w-[420px] rounded-lg border border-line bg-surface p-2 shadow-xl">
                <IntelligentSearch
                  items={MATERIALS}
                  columns={[
                    { header: "Code", get: (m) => m.code, mono: true },
                    { header: "Material", get: (m) => m.name, grow: true },
                    { header: "Unit", get: (m) => m.unit },
                  ]}
                  getKey={(m) => m.code}
                  getSearchText={(m) => `${m.code} ${m.name}`}
                  placeholder="Search material to add…"
                  onSelect={(m) => { addLine(m.code, m.name, m.unit); setPicking(false); }}
                />
              </div>
            )}
          </div>
        )}

        <div onContextMenu={(e) => e.preventDefault()}>
          <EditableRowTable
            rows={lines}
            columns={columns}
            getRowId={(l) => l.id}
            onEdit={edit}
            onAdd={canEdit ? () => addLine() : undefined}
            onDelete={canEdit ? remove : undefined}
            onRowContextMenu={canEdit ? (e, id) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id }); } : undefined}
            addLabel="+ Add allowance line"
            readOnly={!canEdit}
            emptyMessage="No allowance lines yet."
          />
        </div>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Add line here", onClick: () => addLine() },
            { label: "Remove line", danger: true, onClick: () => remove(menu.id) },
          ]}
        />
      )}
    </div>
  );
}
