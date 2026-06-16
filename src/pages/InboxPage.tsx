import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStore } from "@/store/store";
import type { Contract, InventoryItem, ReviewQueueItem } from "@/domain/types";
import { Pill } from "@/components/ui/Pill";
import { ChevronRight, ChevronDown, SearchIcon, LayersIcon } from "@/components/ui/icons";
import { formatWaiting, waitingTone } from "@/lib/format";

type Row =
  | { kind: "item"; item: ReviewQueueItem; selectableIndex: number }
  | { kind: "cluster"; key: string; items: ReviewQueueItem[]; expanded: boolean }
  | { kind: "child"; item: ReviewQueueItem; selectableIndex: number };

export function InboxPage() {
  const items = useStore((s) => s.items);
  const contractsById = useStore((s) => s.contractsById);
  const setInventoryStatus = useStore((s) => s.setInventoryStatus);
  const navigate = useNavigate();

  const queue = useMemo(() => buildQueue(items, contractsById), [items, contractsById]);

  const [q, setQ] = useState("");
  const [producer, setProducer] = useState("");
  const [material, setMaterial] = useState("");
  const [dedup, setDedup] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");
  const lastIndex = useRef<number | null>(null);

  const producerOptions = useMemo(() => distinct(queue, (i) => [i.producerNumber, i.producerName]), [queue]);
  const materialOptions = useMemo(
    () => distinct(queue, (i) => [i.materialCode, `${i.materialCode} — ${i.materialName}`]),
    [queue],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return queue.filter((i) => {
      if (producer && i.producerNumber !== producer) return false;
      if (material && i.materialCode !== material) return false;
      if (!needle) return true;
      return (
        i.materialCode.toLowerCase().includes(needle) ||
        i.materialName.toLowerCase().includes(needle) ||
        i.producerName.toLowerCase().includes(needle) ||
        i.supplierName.toLowerCase().includes(needle) ||
        i.contractNumber.includes(needle) ||
        i.contractName.toLowerCase().includes(needle)
      );
    });
  }, [queue, q, producer, material]);

  // Build the flat (possibly grouped) row list. `selectableIndex` enables shift-range.
  const { rows, selectableIds } = useMemo(() => {
    const out: Row[] = [];
    const ids: string[] = [];
    if (!dedup) {
      filtered.forEach((item) => {
        out.push({ kind: "item", item, selectableIndex: ids.length });
        ids.push(item.id);
      });
      return { rows: out, selectableIds: ids };
    }
    // group by dedupeKey, ordered by each group's oldest member
    const groups = new Map<string, ReviewQueueItem[]>();
    for (const it of filtered) {
      const g = groups.get(it.dedupeKey);
      if (g) g.push(it);
      else groups.set(it.dedupeKey, [it]);
    }
    const ordered = [...groups.entries()].sort(
      (a, b) => oldest(a[1]) - oldest(b[1]),
    );
    for (const [key, members] of ordered) {
      if (members.length === 1) {
        out.push({ kind: "item", item: members[0], selectableIndex: ids.length });
        ids.push(members[0].id);
      } else {
        const isOpen = expanded.has(key);
        out.push({ kind: "cluster", key, items: members, expanded: isOpen });
        if (isOpen) {
          for (const m of members) {
            out.push({ kind: "child", item: m, selectableIndex: ids.length });
            ids.push(m.id);
          }
        } else {
          // collapsed cluster still contributes its ids for select-all math
          for (const m of members) ids.push(m.id);
        }
      }
    }
    return { rows: out, selectableIds: ids };
  }, [filtered, dedup, expanded]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 12,
  });

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleMany = (ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };
  const selectRangeTo = (idx: number) => {
    if (lastIndex.current === null) return;
    const [a, b] = [lastIndex.current, idx].sort((x, y) => x - y);
    toggleMany(selectableIds.slice(a, b + 1), true);
  };

  const selectedContracts = useMemo(() => {
    const set = new Set<string>();
    for (const it of queue) if (selected.has(it.id)) set.add(it.contractId);
    return set.size;
  }, [selected, queue]);

  const approve = (ids: string[]) => {
    if (ids.length === 0) return;
    setInventoryStatus(ids, "Review Complete", bulkNote.trim() ? { note: bulkNote.trim() } : undefined);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setBulkNote("");
  };

  const oldestWaiting = filtered.length ? formatWaiting(filtered[0].waitingMs) : "—";
  const dupeCount = useMemo(
    () => (dedup ? rows.filter((r) => r.kind === "cluster").length : countClusters(filtered)),
    [rows, dedup, filtered],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* heading + stats */}
      <div className="border-b border-line bg-surface px-5 pb-3 pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">My Work Tasks</h1>
            <p className="text-sm text-ink-soft">
              Everything <span className="font-medium text-blue-700">Ready for Review</span> across all
              contracts — oldest waiting first.
            </p>
          </div>
          <div className="flex gap-5 text-right">
            <Stat value={filtered.length.toLocaleString()} label="ready to review" />
            <Stat value={String(new Set(filtered.map((i) => i.contractId)).size)} label="contracts" />
            <Stat value={oldestWaiting} label="oldest waiting" />
          </div>
        </div>

        {/* filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 focus-within:border-accent">
            <SearchIcon className="text-base text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by material, producer, supplier, contract…"
              className="w-72 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
          <Select value={producer} onChange={setProducer} placeholder="All producers" options={producerOptions} />
          <Select value={material} onChange={setMaterial} placeholder="All materials" options={materialOptions} />
          <button
            onClick={() => setDedup((v) => !v)}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
              dedup ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas",
            ].join(" ")}
            title="Collapse duplicates (same material + producer + supplier)"
          >
            <LayersIcon className="text-base" />
            Collapse duplicates
            {dupeCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">
                {dupeCount}
              </span>
            )}
          </button>
          {(q || producer || material) && (
            <button
              onClick={() => {
                setQ("");
                setProducer("");
                setMaterial("");
              }}
              className="text-xs text-ink-faint hover:text-ink"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* select-all row */}
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-accent"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => toggleMany(selectableIds, e.target.checked)}
          />
          Select all {selectableIds.length.toLocaleString()}
        </label>
      </div>

      {/* virtualized list */}
      <div ref={parentRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-soft">
            Nothing is waiting for review with these filters. 🎉
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const row = rows[vr.index];
              return (
                <div
                  key={vr.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: 60,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  {row.kind === "cluster" ? (
                    <ClusterRow
                      row={row}
                      selected={selected}
                      onToggleExpand={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        })
                      }
                      onToggleAll={(on) => toggleMany(row.items.map((i) => i.id), on)}
                      onApproveAll={() => approve(row.items.map((i) => i.id))}
                    />
                  ) : (
                    <ItemRow
                      item={row.item}
                      child={row.kind === "child"}
                      selected={selected.has(row.item.id)}
                      onToggle={(e) => {
                        if (e.shiftKey) selectRangeTo(row.selectableIndex);
                        else {
                          lastIndex.current = row.selectableIndex;
                          toggle(row.item.id);
                        }
                      }}
                      onOpen={() =>
                        navigate(`/contract/${row.item.contractId}/inventory/${row.item.id}`)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-t border-line bg-surface px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-semibold text-ink">
            {selected.size.toLocaleString()} selected
            <span className="ml-1 font-normal text-ink-soft">across {selectedContracts} contracts</span>
          </span>
          <input
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="Add a note to all (optional)…"
            className="ml-2 flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={() => approve([...selected])}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            Mark Review Complete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-canvas"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// --- rows ------------------------------------------------------------------

function ItemRow({
  item,
  child,
  selected,
  onToggle,
  onOpen,
}: {
  item: ReviewQueueItem;
  child?: boolean;
  selected: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onOpen: () => void;
}) {
  const tone = waitingTone(item.waitingMs);
  return (
    <div
      onClick={onToggle}
      className={[
        "flex h-[60px] cursor-pointer items-center gap-3 border-b border-line/70 px-5",
        selected ? "bg-accent-soft" : "hover:bg-canvas",
        child ? "pl-12" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        readOnly
        checked={selected}
        onClick={onToggle}
        className="h-4 w-4 cursor-pointer accent-accent"
      />
      <div className="w-[150px] shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="font-mono text-[13px] font-semibold text-accent hover:underline"
        >
          {item.contractNumber}
        </button>
        <div className="truncate text-[11px] text-ink-faint">Inv {item.inventoryId}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">
          <span className="font-mono font-semibold">{item.materialCode}</span>
          <span className="mx-1.5 text-ink-faint">—</span>
          {item.materialName}
        </div>
        <div className="truncate text-xs text-ink-soft">
          {item.producerName} · {item.supplierName}
        </div>
      </div>
      <div className="w-[120px] shrink-0 text-right">
        <Pill tone={tone}>{formatWaiting(item.waitingMs)}</Pill>
      </div>
    </div>
  );
}

function ClusterRow({
  row,
  selected,
  onToggleExpand,
  onToggleAll,
  onApproveAll,
}: {
  row: Extract<Row, { kind: "cluster" }>;
  selected: Set<string>;
  onToggleExpand: () => void;
  onToggleAll: (on: boolean) => void;
  onApproveAll: () => void;
}) {
  const ids = row.items.map((i) => i.id);
  const all = ids.every((id) => selected.has(id));
  const some = ids.some((id) => selected.has(id)) && !all;
  const head = row.items[0];
  return (
    <div className="flex h-[60px] items-center gap-3 border-b border-line bg-amber-50/40 px-5">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-accent"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some;
        }}
        onChange={(e) => onToggleAll(e.target.checked)}
      />
      <button onClick={onToggleExpand} className="flex items-center text-ink-soft hover:text-ink">
        {row.expanded ? <ChevronDown className="text-lg" /> : <ChevronRight className="text-lg" />}
      </button>
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
        {row.items.length}× duplicate
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">
          <span className="font-mono font-semibold">{head.materialCode}</span>
          <span className="mx-1.5 text-ink-faint">—</span>
          {head.materialName}
        </div>
        <div className="truncate text-xs text-ink-soft">
          {head.producerName} · {head.supplierName} · Contract {head.contractNumber}
        </div>
      </div>
      <button
        onClick={onApproveAll}
        className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
      >
        Approve all {row.items.length}
      </button>
    </div>
  );
}

// --- small bits ------------------------------------------------------------

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[220px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// --- helpers ---------------------------------------------------------------

function buildQueue(items: InventoryItem[], contractsById: Map<string, Contract>): ReviewQueueItem[] {
  const now = Date.now();
  const out: ReviewQueueItem[] = [];
  for (const it of items) {
    if (it.status !== "Ready for Review") continue;
    const c = contractsById.get(it.contractId);
    out.push({
      ...it,
      contractName: c?.name ?? it.contractNumber,
      waitingMs: it.readyAt ? now - it.readyAt : 0,
      dedupeKey: `${it.contractId}|${it.materialCode}|${it.producerNumber}|${it.supplierNumber}`,
    });
  }
  out.sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));
  return out;
}

function distinct(
  queue: ReviewQueueItem[],
  pick: (i: ReviewQueueItem) => [string, string],
): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const i of queue) {
    const [value, label] = pick(i);
    if (!map.has(value)) map.set(value, label);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function oldest(items: ReviewQueueItem[]): number {
  return Math.min(...items.map((i) => i.readyAt ?? Infinity));
}

function countClusters(queue: ReviewQueueItem[]): number {
  const counts = new Map<string, number>();
  for (const i of queue) counts.set(i.dedupeKey, (counts.get(i.dedupeKey) ?? 0) + 1);
  let n = 0;
  for (const c of counts.values()) if (c > 1) n++;
  return n;
}
