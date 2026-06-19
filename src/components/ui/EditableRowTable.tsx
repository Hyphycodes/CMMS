/**
 * Inline-editable row grid. Rows are added with a visible "+ Add row" button
 * (right-click ContextMenu stays the power path where wired). Each cell edit
 * commits through `onEdit`, which the parent persists via an optimistic store
 * mutation (modeled on setEoiApproval) — so "dirty/save" is the global Saving…
 * indicator + rollback toast. Optional totals footer.
 *
 * Powers the writable Quantity Ledger + EOI (05), placements (08), tests (04).
 */
import type { ReactNode, MouseEvent } from "react";

export interface EditableColumn<T> {
  key: string;
  header: string;
  /** CSS grid track, e.g. "120px" or "minmax(0,1fr)". */
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T, edit: (patch: Partial<T>) => void) => ReactNode;
  footer?: (rows: T[]) => ReactNode;
}

interface Props<T> {
  rows: T[];
  columns: EditableColumn<T>[];
  getRowId: (row: T) => string;
  onEdit: (id: string, patch: Partial<T>) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  /** Right-click a row → contextual menu (brief 21). Receives the row id. */
  onRowContextMenu?: (e: MouseEvent, id: string) => void;
  addLabel?: string;
  readOnly?: boolean;
  emptyMessage?: string;
}

export function EditableRowTable<T>({
  rows,
  columns,
  getRowId,
  onEdit,
  onAdd,
  onDelete,
  onRowContextMenu,
  addLabel = "+ Add row",
  readOnly = false,
  emptyMessage = "No records to display.",
}: Props<T>) {
  const hasFooter = columns.some((c) => c.footer);
  const showActions = !readOnly && !!onDelete;
  const template = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ") + (showActions ? " 76px" : "");

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <div style={{ minWidth: columns.length * 120 }}>
          {/* header */}
          <div
            className="grid items-center gap-2 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => (
              <span key={c.key} className={c.align === "right" ? "text-right" : ""}>
                {c.header}
              </span>
            ))}
            {showActions && <span className="text-right" />}
          </div>

          {/* rows */}
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">{emptyMessage}</p>
          ) : (
            rows.map((row) => {
              const id = getRowId(row);
              const edit = (patch: Partial<T>) => onEdit(id, patch);
              return (
                <div
                  key={id}
                  onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, id) : undefined}
                  className="grid items-center gap-2 border-b border-line/70 px-3 py-1.5 text-sm last:border-b-0"
                  style={{ gridTemplateColumns: template }}
                >
                  {columns.map((c) => (
                    <div key={c.key} className={["min-w-0", c.align === "right" ? "text-right" : ""].join(" ")}>
                      {c.render(row, edit)}
                    </div>
                  ))}
                  {showActions && (
                    <div className="text-right">
                      <button
                        onClick={() => onDelete?.(id)}
                        className="rounded-md px-2 py-1 text-xs text-ink-faint transition hover:bg-red-50 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* totals footer */}
          {hasFooter && rows.length > 0 && (
            <div
              className="grid items-center gap-2 border-t border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((c) => (
                <div key={c.key} className={c.align === "right" ? "text-right tabular-nums" : ""}>
                  {c.footer ? c.footer(rows) : null}
                </div>
              ))}
              {showActions && <span />}
            </div>
          )}
        </div>
      </div>

      {!readOnly && onAdd && (
        <button
          onClick={onAdd}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-soft"
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

// --- small inline cell editors (reused by 04 / 05 / 08) --------------------

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60";

export function EditText({
  value,
  onCommit,
  placeholder,
  mono,
  disabled,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      defaultValue={value}
      disabled={disabled}
      placeholder={placeholder}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={[inputCls, mono ? "font-mono" : ""].join(" ")}
    />
  );
}

export function EditNumber({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      defaultValue={value}
      disabled={disabled}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n) && n !== value) onCommit(n);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${inputCls} text-right tabular-nums`}
    />
  );
}

export function EditDate({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      disabled={disabled}
      onChange={(e) => onCommit(e.target.value)}
      className={inputCls}
    />
  );
}

export function EditSelect<O extends string>({
  value,
  options,
  onCommit,
  disabled,
}: {
  value: O;
  options: readonly O[];
  onCommit: (v: O) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onCommit(e.target.value as O)}
      className={inputCls}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Toggle-chip multi-select (Actual EOI / Actual MOA in brief 05). */
export function EditChips<O extends string>({
  selected,
  options,
  onToggle,
  disabled,
}: {
  selected: O[];
  options: readonly O[];
  onToggle: (next: O[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(on ? selected.filter((s) => s !== o) : [...selected, o])}
            className={[
              "rounded-md border px-1.5 py-0.5 text-xs font-medium transition",
              on ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:bg-canvas",
            ].join(" ")}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
