/**
 * Generalized virtualized grid — TanStack Table + Virtual. Generic over <T>:
 * sticky sortable header, optional multi-select with header select-all +
 * shift-range, row click + right-click, optional toolbar (global filter,
 * density toggle, count summary), and virtualization above ~100 rows.
 *
 * Extracted from the inventory grid; the inventory grid is now a thin wrapper
 * over this (behavior unchanged). Reused by Samples (03), Documents (06),
 * Quantity Book (08) and Materials (11).
 */
import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, SearchIcon } from "@/components/ui/icons";

export interface DataGridColumnMeta {
  grow?: boolean;
  align?: "left" | "right" | "center";
}

const VIRTUALIZE_OVER = 100;

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;

  // selection (optional, controlled)
  enableSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  // sorting (optional, controlled — else internal)
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  // built-in toolbar
  toolbar?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** haystack for the global filter; defaults to all visible string cells. */
  globalSearchText?: (row: T) => string;
  toolbarExtras?: React.ReactNode;
  countLabel?: string;

  // chrome
  gridTemplate?: string; // verbatim CSS grid-template-columns (incl. select col)
  rowHeight?: number;
  minWidth?: number;
  emptyMessage?: string;
}

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  onRowContextMenu,
  enableSelection = false,
  rowSelection,
  onRowSelectionChange,
  sorting: sortingProp,
  onSortingChange,
  toolbar = false,
  searchable = false,
  searchPlaceholder = "Filter…",
  globalSearchText,
  toolbarExtras,
  countLabel = "rows",
  gridTemplate,
  rowHeight = 44,
  minWidth = 0,
  emptyMessage = "No records to display.",
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIndex = useRef<number | null>(null);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [dense, setDense] = useState(false);

  const sorting = sortingProp ?? internalSorting;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(enableSelection ? { rowSelection: rowSelection ?? {} } : {}),
      ...(searchable ? { globalFilter } : {}),
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onRowSelectionChange,
    onGlobalFilterChange: searchable ? setGlobalFilter : undefined,
    enableRowSelection: enableSelection,
    getRowId,
    globalFilterFn: globalSearchText
      ? (row, _col, value) =>
          globalSearchText(row.original).toLowerCase().includes(String(value).toLowerCase())
      : "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: searchable ? getFilteredRowModel() : undefined,
  });

  const rows = table.getRowModel().rows;
  const effectiveRowHeight = toolbar && dense ? 34 : rowHeight;

  const template = useMemo(() => {
    if (gridTemplate) return gridTemplate;
    const cols = table.getVisibleLeafColumns().map((c) => {
      const meta = c.columnDef.meta as DataGridColumnMeta | undefined;
      const size = c.getSize();
      return meta?.grow ? `minmax(${size}px, 2fr)` : `${size}px`;
    });
    return (enableSelection ? "44px " : "") + cols.join(" ");
  }, [gridTemplate, enableSelection, table]);

  const virtualize = rows.length > VIRTUALIZE_OVER;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => effectiveRowHeight,
    overscan: 14,
  });

  const selectRange = (toIndex: number) => {
    if (lastIndex.current === null || !onRowSelectionChange) return;
    const [a, b] = [lastIndex.current, toIndex].sort((x, y) => x - y);
    const next: RowSelectionState = { ...(rowSelection ?? {}) };
    for (let i = a; i <= b; i++) next[rows[i].id] = true;
    onRowSelectionChange(next);
  };

  const renderRow = (row: Row<T>, index: number, style?: React.CSSProperties) => {
    const selected = enableSelection && row.getIsSelected();
    return (
      <div
        key={row.id}
        data-index={index}
        role={onRowClick ? "button" : undefined}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={() => onRowClick?.(row.original)}
        onKeyDown={
          onRowClick
            ? (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRowClick(row.original);
                }
              }
            : undefined
        }
        onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, row.original) : undefined}
        className={[
          "grid items-center border-b border-line/70 px-3 text-sm outline-none focus-visible:bg-accent-soft",
          onRowClick ? "cursor-pointer" : "",
          selected ? "bg-accent-soft" : "hover:bg-canvas",
        ].join(" ")}
        style={{ gridTemplateColumns: template, height: effectiveRowHeight, ...style }}
      >
        {enableSelection && (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              aria-label="Select row"
              className="h-4 w-4 cursor-pointer accent-accent"
              checked={selected}
              onClick={(e) => {
                if (e.shiftKey) selectRange(index);
                else lastIndex.current = index;
              }}
              onChange={row.getToggleSelectedHandler()}
            />
          </div>
        )}
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta as DataGridColumnMeta | undefined;
          return (
            <div
              key={cell.id}
              className={[
                "min-w-0 truncate py-1.5 pr-3",
                meta?.align === "right" ? "text-right tabular-nums" : "",
                meta?.align === "center" ? "text-center" : "",
              ].join(" ")}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          {searchable && (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 focus-within:border-accent">
              <SearchIcon className="text-base text-ink-faint" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-64 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
            </div>
          )}
          {toolbarExtras}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-ink-faint tabular-nums">
              {rows.length.toLocaleString()} {countLabel}
            </span>
            <div className="flex items-center rounded-lg border border-line p-0.5">
              {(["Comfortable", "Compact"] as const).map((d) => {
                const isDense = d === "Compact";
                return (
                  <button
                    key={d}
                    onClick={() => setDense(isDense)}
                    className={[
                      "rounded px-2 py-1 text-xs font-medium transition",
                      dense === isDense ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-canvas",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex flex-1 flex-col" style={{ minHeight: 0, minWidth: minWidth || undefined }}>
          {/* header */}
          <div
            className="grid items-center border-b border-line bg-canvas px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
            style={{ gridTemplateColumns: template, height: 38 }}
          >
            {enableSelection && (
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
            )}
            {table.getHeaderGroups()[0].headers.map((header) => {
              const sort = header.column.getIsSorted();
              const meta = header.column.columnDef.meta as DataGridColumnMeta | undefined;
              return (
                <button
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={[
                    "flex items-center gap-1 py-2 hover:text-ink",
                    meta?.align === "right" ? "justify-end text-right" : "text-left",
                  ].join(" ")}
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

          {/* body */}
          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="grid h-full place-items-center py-12 text-sm text-ink-soft">{emptyMessage}</div>
            ) : virtualize ? (
              <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                {virtualizer.getVirtualItems().map((vr) =>
                  renderRow(rows[vr.index], vr.index, {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vr.start}px)`,
                  }),
                )}
              </div>
            ) : (
              rows.map((row, i) => renderRow(row, i))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
