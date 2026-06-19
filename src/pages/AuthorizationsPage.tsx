/**
 * Authorizations (brief 10). Typed creation, pay item add/edit, computed net
 * change, ordered district approval (Draft → In Approval → Published), and a
 * single publish→propagate path (pay item awarded quantities + contract value).
 * Replaces the stub.
 */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store/store";
import { AUTH_STEPS } from "@/data/seed/generate";
import { AUTH_TYPES, type AuthType, type Authorization, type AuthItem } from "@/domain/types";
import { TabBar } from "@/components/ui/TabBar";
import { Pill } from "@/components/ui/Pill";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { FileDrop } from "@/components/ui/FileDrop";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { contentHash } from "@/domain/history";
import { IntelligentSearch } from "@/components/ui/IntelligentSearch";
import { EditableRowTable, EditText, EditNumber, type EditableColumn } from "@/components/ui/EditableRowTable";
import { CheckIcon } from "@/components/ui/icons";
import type { PillTone } from "@/domain/status";
import { formatMoney, formatDate, formatNumber } from "@/lib/format";

const STATUS_TONE: Record<Authorization["status"], PillTone> = {
  Draft: "slate",
  "In Approval": "amber",
  Published: "green",
};

export function AuthorizationsPage() {
  const { contractId = "" } = useParams();
  const contract = useStore((s) => s.contract(contractId));
  const canAccess = useStore((s) => s.canAccessContract(contractId));
  const canManage = useStore((s) => s.can("manage_authorization"));
  const authorizationsList = useStore((s) => s.authorizationsList);
  const saveAuthorization = useStore((s) => s.saveAuthorization);

  const auths = useMemo(
    () => authorizationsList.filter((a) => a.contractId === contractId).sort((a, b) => a.number - b.number),
    [authorizationsList, contractId],
  );
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = auths.find((a) => a.id === selectedId) ?? auths[auths.length - 1];
  const totalNet = auths.reduce((s, a) => s + (a.status === "Published" ? a.netChange : 0), 0);

  if (!contract) return <div className="grid h-full place-items-center text-ink-soft">Select a contract.</div>;
  if (!canAccess)
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">You don't have access to contract {contract.number}.</div>;

  const createAuth = (type: AuthType) => {
    const number = auths.length ? Math.max(...auths.map((a) => a.number)) + 1 : 1;
    const auth: Authorization = {
      id: `auth_new_${contractId}_${Date.now()}`,
      contractId,
      number,
      type,
      description: "",
      netChange: 0,
      status: "Draft",
      createdDate: new Date().toISOString().slice(0, 10),
      items: [],
      approvals: AUTH_STEPS[type].map((step) => ({ step, approver: null, approvedAt: null })),
      hasAttachment: false,
    };
    saveAuthorization(auth);
    setSelectedId(auth.id);
    setCreating(false);
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-ink">Authorizations</h1>
            <p className="text-xs text-ink-soft">Net published {formatMoney(totalNet)}</p>
          </div>
          {canManage && (
            <button onClick={() => setCreating((v) => !v)} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover">+ Create</button>
          )}
        </div>
        {creating && (
          <div className="border-b border-line bg-canvas p-3">
            <p className="mb-2 text-xs font-medium text-ink-soft">Choose type:</p>
            {AUTH_TYPES.map((t) => (
              <button key={t} onClick={() => createAuth(t)} className="mb-1 block w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm hover:border-accent hover:bg-accent-soft">{t}</button>
            ))}
          </div>
        )}
        {auths.map((a) => {
          const active = selected?.id === a.id;
          return (
            <button key={a.id} onClick={() => setSelectedId(a.id)} className={["block w-full border-b border-line/70 px-4 py-2.5 text-left transition", active ? "bg-accent-soft" : "hover:bg-canvas"].join(" ")}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Auth #{a.number}</span>
                <Pill tone={STATUS_TONE[a.status]}>{a.status}</Pill>
              </div>
              <div className="truncate text-xs text-ink-soft">{a.type}</div>
              <div className={["text-xs font-medium tabular-nums", a.netChange >= 0 ? "text-green-700" : "text-red-700"].join(" ")}>{a.netChange >= 0 ? "+" : ""}{formatMoney(a.netChange)}</div>
            </button>
          );
        })}
        {auths.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">No authorizations yet.</p>}
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? <AuthDetail auth={selected} canManage={canManage} /> : <div className="grid h-full place-items-center text-sm text-ink-soft">Create the first authorization.</div>}
      </div>
    </div>
  );
}

function AuthDetail({ auth, canManage }: { auth: Authorization; canManage: boolean }) {
  const payItems = useStore((s) => s.payItemsFor(auth.contractId));
  const saveAuthorization = useStore((s) => s.saveAuthorization);
  const submitAuthorization = useStore((s) => s.submitAuthorization);
  const advanceAuthApproval = useStore((s) => s.advanceAuthApproval);
  const [tab, setTab] = useState<"Detail" | "Items" | "Approvals">("Detail");
  const editable = canManage && auth.status === "Draft";

  const setItems = (items: AuthItem[]) => saveAuthorization({ ...auth, items });
  const editItem = (id: string, patch: Partial<AuthItem>) =>
    setItems(auth.items.map((it, i) => (String(i) === id ? { ...it, ...patch } : it)));

  const columns: EditableColumn<AuthItem>[] = [
    { key: "payItem", header: "Pay Item", width: "minmax(110px,1fr)", render: (it) => <EditText value={it.payItemNumber} disabled={!editable} mono onCommit={(v) => editItem(String(auth.items.indexOf(it)), { payItemNumber: v })} /> },
    { key: "desc", header: "Description", width: "minmax(160px,1.6fr)", render: (it) => <EditText value={it.description} disabled={!editable} onCommit={(v) => editItem(String(auth.items.indexOf(it)), { description: v })} /> },
    { key: "unit", header: "Unit", width: "90px", render: (it) => <EditText value={it.unit} disabled={!editable} onCommit={(v) => editItem(String(auth.items.indexOf(it)), { unit: v })} /> },
    { key: "qty", header: "Qty Change", width: "110px", align: "right", render: (it) => <EditNumber value={it.quantity} disabled={!editable} onCommit={(v) => editItem(String(auth.items.indexOf(it)), { quantity: v })} /> },
    { key: "price", header: "Unit Price", width: "110px", align: "right", render: (it) => <EditNumber value={it.unitPrice} disabled={!editable} onCommit={(v) => editItem(String(auth.items.indexOf(it)), { unitPrice: v })} /> },
    { key: "new", header: "New?", width: "70px", align: "center", render: (it) => (it.isNew ? <Pill tone="indigo">New</Pill> : <span className="text-xs text-ink-faint">—</span>) },
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line bg-surface px-5 pt-3">
        <span className="text-lg font-bold text-ink">Auth #{auth.number}</span>
        <Pill tone={STATUS_TONE[auth.status]}>{auth.status}</Pill>
        <span className="text-sm text-ink-soft">{auth.type}</span>
        <div className="ml-auto flex items-center gap-2 pb-2">
          <button onClick={() => printBC24(auth)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Print BC 24</button>
          {canManage && auth.status === "Draft" && (
            <button onClick={() => submitAuthorization(auth.id)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Submit for approval</button>
          )}
          {canManage && auth.status === "In Approval" && (
            <button onClick={() => advanceAuthApproval(auth.id)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">Approve next step</button>
          )}
        </div>
      </div>
      <TabBar tabs={[{ id: "Detail", label: "Detail" }, { id: "Items", label: "Items", count: auth.items.length }, { id: "Approvals", label: "Approvals", count: auth.approvals.length }]} active={tab} onChange={setTab} className="bg-surface px-5" />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "Detail" && (
          <div className="max-w-2xl space-y-4">
            <FieldGroup title="Authorization" showEmpty fields={[
              { label: "Number", value: auth.number, type: "number" },
              { label: "Type", value: auth.type },
              { label: "Status", value: auth.status },
              { label: "Created", value: auth.createdDate, type: "date" },
              { label: "Net Change", value: auth.netChange, type: "money" },
            ]} />
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-soft">Attachment (BC 24)</span>
              <FileDrop scope={{ entity: "authorization", entityId: auth.id }} disabled={!editable} label="Attach BC 24" />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Description</span>
              <textarea value={auth.description} disabled={!editable} rows={3} onChange={(e) => saveAuthorization({ ...auth, description: e.target.value })} className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70" />
            </label>
            {auth.type !== "Standard" && (
              <p className="text-xs text-amber-700">{auth.type} requires the extended approval chain ({AUTH_STEPS[auth.type].length} steps).</p>
            )}
            {auth.status === "Published" && (
              <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink-soft">
                Published content hash:{" "}
                <span className="font-mono font-semibold text-ink">
                  {contentHash({ items: auth.items, netChange: auth.netChange, approvals: auth.approvals })}
                </span>{" "}
                — tamper-evident (P4).
              </p>
            )}
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">History</div>
              <HistoryPanel entity="authorization" entityId={auth.id} />
            </div>
          </div>
        )}

        {tab === "Items" && (
          <div className="space-y-3">
            {editable && (
              <div className="max-w-md">
                <label className="mb-1 block text-xs font-medium text-ink-soft">Add existing pay item</label>
                <IntelligentSearch
                  items={payItems}
                  columns={[{ header: "Number", get: (p) => p.number, mono: true }, { header: "Description", get: (p) => p.description, grow: true }]}
                  getKey={(p) => p.number}
                  getSearchText={(p) => `${p.number} ${p.description}`}
                  onSelect={(p) => setItems([...auth.items, { payItemNumber: p.number, description: p.description, unit: p.unit, quantity: 0, unitPrice: p.unitPrice, isNew: false }])}
                  placeholder="Search pay items…"
                />
              </div>
            )}
            <EditableRowTable
              rows={auth.items}
              columns={columns}
              getRowId={(it) => String(auth.items.indexOf(it))}
              onEdit={editItem}
              onAdd={editable ? () => setItems([...auth.items, { payItemNumber: "", description: "NEW ITEM", unit: "EACH", quantity: 0, unitPrice: 0, isNew: true }]) : undefined}
              onDelete={editable ? (id) => setItems(auth.items.filter((_, i) => String(i) !== id)) : undefined}
              addLabel="+ Add new item"
              readOnly={!editable}
              emptyMessage="No items on this authorization."
            />
            <p className="text-sm font-semibold text-ink">Net change: <span className={auth.netChange >= 0 ? "text-green-700" : "text-red-700"}>{auth.netChange >= 0 ? "+" : ""}{formatMoney(auth.netChange)}</span></p>
            {auth.status === "Published" && <p className="text-xs text-ink-faint">Published — quantities propagated to pay item awarded quantities and the contract adjusted value.</p>}
          </div>
        )}

        {tab === "Approvals" && (
          <div className="max-w-xl space-y-2">
            <p className="text-xs text-ink-soft">Ordered district approval. Each step records approver + timestamp; the final step publishes and propagates.</p>
            {auth.approvals.map((a, i) => {
              const signed = a.approver !== null;
              const isNext = !signed && auth.approvals.slice(0, i).every((x) => x.approver !== null);
              return (
                <div key={i} className={["flex items-center gap-3 rounded-lg border p-3", signed ? "border-green-200 bg-green-50/40" : isNext ? "border-accent/40 bg-accent-soft" : "border-line"].join(" ")}>
                  <span className={["flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", signed ? "bg-green-600 text-white" : "bg-line text-ink-soft"].join(" ")}>
                    {signed ? <CheckIcon className="text-sm" /> : i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{a.step}</div>
                    {signed && <div className="text-xs text-ink-soft">{a.approver} · {formatDate(a.approvedAt)}</div>}
                  </div>
                  {isNext && auth.status === "In Approval" && canManage && (
                    <button onClick={() => advanceAuthApproval(auth.id)} className="rounded-lg border border-accent bg-accent-soft px-3 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-white">Approve</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function printBC24(auth: Authorization) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const rows = auth.items.map((it) => `<tr><td>${it.payItemNumber}</td><td>${it.description}</td><td>${formatNumber(it.quantity, 2)} ${it.unit}</td><td>${formatMoney(it.unitPrice)}</td></tr>`).join("");
  w.document.write(`<!doctype html><title>BC 24 — Auth #${auth.number}</title><body style="font-family:ui-sans-serif,system-ui;padding:24px">
    <h2>Authorization of Contract Changes (BC 24)</h2>
    <p><b>Auth #${auth.number}</b> · ${auth.type} · ${auth.status}</p>
    <p>${auth.description || ""}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#f2f4f7"><th>Pay Item</th><th>Description</th><th>Qty Change</th><th>Unit Price</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <p style="margin-top:12px"><b>Net change: ${formatMoney(auth.netChange)}</b></p></body>`);
  w.document.close();
  w.focus();
  w.print();
}
