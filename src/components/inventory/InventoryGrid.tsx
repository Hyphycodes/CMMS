import { useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { InventoryItem } from "@/domain/types";
import { inventoryColumns } from "./columns";
import { ChevronDown } from "@/components/ui/icons";

// Shared grid template keeps the (non-scrolling) header aligned with the
// virtualized body, and flexes so normal widths need no horizontal scroll.
const GRID_TEMPLATE =
  "44px 110px minmax(220px,2fr) minmax(168px,1.3fr) minmax(168px,1.3fr) 172px 120px minmax(140px,1.1fr)";

interface Props {
  data: InventoryItem[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onOpen: (item: InventoryItem) => void;
  onContext: (e: React.MouseEvent, item: InventoryItem) => void;
}

export function InventoryGrid({
  data,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onOpen,
  onContext,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIndex = useRef<number | null>(null);

  const table = useReactTable({
    data,
    columns: inventoryColumns,
    state: { sorting, rowSelection },
    onSortingChange,
    onRowSelectionChange,
    enableRowSelection: true,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 14,
  });

  const selectRange = (toIndex: number) => {
    if (lastIndex.current === null) return;
    const [a, b] = [lastIndex.current, toIndex].sort((x, y) => x - y);
    const next: RowSelectionState = { ...rowSelection };
    for (let i = a; i <= b; i++) next[rows[i].id] = true;
    onRowSelectionChange(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-auto bg-surface">
      <div className="flex min-w-[940px] flex-1 flex-col" style={{ minHeight: 0 }}>
        {/* header (does not scroll vertically) */}
        <div
          className="grid items-center border-b border-line bg-canvas px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
          style={{ gridTemplateColumns: GRID_TEMPLATE, height: 38 }}
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label="Select all"
              className="h-4 w-4 cursor-pointer accent-accent"
              checked={table.getIsAllRowsSelected()}
              ref={(el) => {
                if (el) el.indeterminate = table.getIsSomeRowsSelected();
              }}
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
          </div>
          {table.getHeaderGroups()[0].headers.map((header) => {
            const sort = header.column.getIsSorted();
            return (
              <button
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className="flex items-center gap-1 py-2 text-left hover:text-ink"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                <ChevronDown
                  className={[
                    "text-xs transition",
                    sort === "asc" ? "rotate-180 text-accent" : sort === "desc" ? "text-accent" : "opacity-0",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>

        {/* virtualized body */}
        <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const row = rows[vr.index];
              const item = row.original;
              const selected = row.getIsSelected();
              return (
                <div
                  key={row.id}
                  data-index={vr.index}
                  onClick={() => onOpen(item)}
                  onContextMenu={(e) => onContext(e, item)}
                  className={[
                    "grid cursor-pointer items-center border-b border-line/70 px-3 text-sm",
                    selected ? "bg-accent-soft" : "hover:bg-canvas",
                  ].join(" ")}
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: 44,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.inventoryId}`}
                      className="h-4 w-4 cursor-pointer accent-accent"
                      checked={selected}
                      onClick={(e) => {
                        if (e.shiftKey) selectRange(vr.index);
                        else lastIndex.current = vr.index;
                      }}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </div>
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="min-w-0 truncate py-1.5 pr-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
