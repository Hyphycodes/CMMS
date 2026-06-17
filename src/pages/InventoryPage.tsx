import { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { SortingState, RowSelectionState } from "@tanstack/react-table";
import { useStore } from "@/store/store";
import { INVENTORY_STATUSES, type InventoryItem, type InventoryStatus } from "@/domain/types";
import { InventoryGrid } from "@/components/inventory/InventoryGrid";
import { ItemDetailDrawer } from "@/components/inventory/ItemDetailDrawer";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ContextMenu, type MenuItem } from "@/components/ui/ContextMenu";
import { SearchIcon, PlusIcon } from "@/components/ui/icons";

const PERF_OPTIONS = [
  { label: "1k", value: 1000 },
  { label: "10k", value: 10_000 },
  { label: "50k", value: 50_000 },
];

export function InventoryPage() {
  const { contractId, itemId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const contract = useStore((s) => (contractId ? s.contract(contractId) : undefined));
  const canAccess = useStore((s) => (contractId ? s.canAccessContract(contractId) : false));
  const canCreate = useStore((s) => s.can("create_inventory"));
  const allItems = useStore((s) => s.items);
  const setInventoryStatus = useStore((s) => s.setInventoryStatus);

  const baseItems = useMemo(
    () => allItems.filter((i) => i.contractId === contractId),
    [allItems, contractId],
  );

  const q = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? "All";
  const [perfCount, setPerfCount] = useState(0);
  const perfEnabled = import.meta.env.DEV || params.has("perf");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [menu, setMenu] = useState<{ x: number; y: number; item: InventoryItem } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: baseItems.length };
    for (const s of INVENTORY_STATUSES) c[s] = 0;
    for (const it of baseItems) c[it.status]++;
    return c;
  }, [baseItems]);

  const filtered = useMemo(() => {
    let list = baseItems;
    if (statusFilter !== "All") list = list.filter((i) => i.status === statusFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (i) =>
          i.materialCode.toLowerCase().includes(needle) ||
          i.materialName.toLowerCase().includes(needle) ||
          i.producerName.toLowerCase().includes(needle) ||
          i.supplierName.toLowerCase().includes(needle) ||
          i.inventoryId.includes(needle) ||
          i.payItemNumbers.some((p) => p.includes(needle)),
      );
    }
    return list;
  }, [baseItems, statusFilter, q]);

  const data = useMemo(
    () => (perfCount > 0 ? expandItems(filtered.length ? filtered : baseItems, perfCount) : filtered),
    [filtered, perfCount, baseItems],
  );

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id] && !id.includes("__x")),
    [rowSelection],
  );

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "All") next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const applyStatus = (ids: string[], status: InventoryStatus) => {
    setInventoryStatus(ids, status);
    setRowSelection({});
  };

  const openItem = (item: InventoryItem) => {
    if (item.id.includes("__x")) return; // synthetic perf row
    navigate(`/contract/${contractId}/inventory/${item.id}`);
  };

  const onContext = (e: React.MouseEvent, item: InventoryItem) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, item });
  };

  const menuItems = (item: InventoryItem): MenuItem[] => {
    const targets = selectedIds.includes(item.id) ? selectedIds : [item.id];
    const many = targets.length > 1;
    const suffix = many ? ` (${targets.length})` : "";
    return [
      { label: "Open details", onClick: () => openItem(item), disabled: item.id.includes("__x") },
      { separator: true, label: "" },
      { label: `Mark Ready for Review${suffix}`, onClick: () => applyStatus(targets, "Ready for Review") },
      { label: `Mark Review Complete${suffix}`, onClick: () => applyStatus(targets, "Review Complete") },
      { label: `Mark Needs Attention${suffix}`, onClick: () => applyStatus(targets, "Needs Attention") },
    ];
  };

  if (!contract) {
    return <div className="grid h-full place-items-center text-ink-soft">Select a contract to begin.</div>;
  }
  if (!canAccess) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">
        You don't have access to contract {contract.number}. It isn't in your assigned scope.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* page heading + toolbar */}
      <div className="flex flex-col gap-3 border-b border-line bg-surface px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink">Inventory</h1>
          <span className="text-sm text-ink-faint">
            {perfCount > 0 ? `${perfCount.toLocaleString()} rows (perf preview)` : `${counts.All} items`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                if (!canCreate) return;
                const next = new URLSearchParams(params);
                next.set("new", "1");
                setParams(next, { replace: true });
              }}
              disabled={!canCreate}
              title={canCreate ? undefined : "Your role can't create inventory."}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="text-base" /> Add Inventory
            </button>
            {perfEnabled && (
              <div className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 p-0.5">
                <span className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Perf
                </span>
                {[{ label: "off", value: 0 }, ...PERF_OPTIONS].map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setPerfCount(o.value)}
                    className={[
                      "rounded px-2 py-1 text-xs font-medium transition",
                      perfCount === o.value ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-100",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 focus-within:border-accent">
            <SearchIcon className="text-base text-ink-faint" />
            <input
              value={q}
              onChange={(e) => updateParam("q", e.target.value)}
              placeholder="Filter material, producer, supplier, ID…"
              className="w-72 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>

          <div className="flex items-center gap-1">
            {["All", ...INVENTORY_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => updateParam("status", s)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  statusFilter === s
                    ? "bg-ink text-white"
                    : "bg-canvas text-ink-soft hover:bg-line/60",
                ].join(" ")}
              >
                {s} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
              </button>
            ))}
          </div>

          {(q || statusFilter !== "All") && (
            <span className="text-xs text-ink-faint">
              {filtered.length.toLocaleString()} match{filtered.length === 1 ? "" : "es"}
            </span>
          )}
        </div>
      </div>

      {/* grid */}
      <div className="relative min-h-0 flex-1">
        {baseItems.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-soft">
            No inventory is associated with this contract yet.
          </div>
        ) : (
          <InventoryGrid
            data={data}
            sorting={sorting}
            onSortingChange={setSorting}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onOpen={openItem}
            onContext={onContext}
          />
        )}

        {/* multi-select action bar */}
        {selectedIds.length > 0 && perfCount === 0 && (
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-xl">
            <span className="px-1 text-sm font-semibold text-ink">
              {selectedIds.length} selected
            </span>
            <div className="h-5 w-px bg-line" />
            <button
              onClick={() => applyStatus(selectedIds, "Review Complete")}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
            >
              Mark Review Complete
            </button>
            <button
              onClick={() => applyStatus(selectedIds, "Ready for Review")}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-canvas"
            >
              Ready for Review
            </button>
            <button
              onClick={() => applyStatus(selectedIds, "Needs Attention")}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-canvas"
            >
              Needs Attention
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="rounded-lg px-2 py-1.5 text-sm text-ink-soft transition hover:bg-canvas"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.item)} onClose={() => setMenu(null)} />
      )}

      {params.get("new") === "1" && contractId && (
        <InventoryForm
          contractId={contractId}
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete("new");
            setParams(next, { replace: true });
          }}
          onSaved={(id) => {
            const next = new URLSearchParams(params);
            next.delete("new");
            setParams(next, { replace: true });
            navigate(`/contract/${contractId}/inventory/${id}`);
          }}
        />
      )}

      {itemId && (
        <ItemDetailDrawer
          itemId={itemId}
          onClose={() => navigate(`/contract/${contractId}/inventory${params.toString() ? `?${params}` : ""}`)}
        />
      )}
    </div>
  );
}

/** Dev-only: synthesize N rows from the contract's items to prove the grid stays smooth. */
function expandItems(base: InventoryItem[], count: number): InventoryItem[] {
  if (base.length === 0) return [];
  const out: InventoryItem[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const b = base[i % base.length];
    out[i] = { ...b, id: `${b.id}__x${i}`, inventoryId: String(900000 + i) };
  }
  return out;
}
