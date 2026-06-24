/**
 * Compact checkbox dropdown (multi-select). Replaces the flat chip rows on the
 * Evidence of Inspection tab so it reads cleaner — the closed control summarizes
 * the picks; opening it reveals a checkbox list you tick to include (PDF p.7:
 * Actual EOI opens as a checkbox list with several ticked). Reuses Proof's
 * border / accent styling so it looks native. No new dependencies.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "@/components/ui/icons";

export interface MultiSelectOption<O extends string> {
  value: O;
  label?: string;
  /** trailing hint shown right-aligned in the open list (e.g. "320/500 TON left") */
  hint?: ReactNode;
  /** render the row grayed + behind a confirm, but still selectable */
  muted?: boolean;
  /** confirm prompt shown before a muted option is toggled on */
  confirm?: string;
}

interface Props<O extends string> {
  selected: O[];
  options: readonly (O | MultiSelectOption<O>)[];
  onChange: (next: O[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** override the closed-state summary (defaults to the joined picks) */
  summary?: (selected: O[]) => ReactNode;
  className?: string;
  /** min width of the closed control */
  width?: number;
}

function norm<O extends string>(o: O | MultiSelectOption<O>): MultiSelectOption<O> {
  return typeof o === "string" ? { value: o } : o;
}

export function MultiSelect<O extends string>({
  selected,
  options,
  onChange,
  disabled,
  placeholder = "—",
  summary,
  className,
  width = 132,
}: Props<O>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const opts = options.map(norm);
  const toggle = (opt: MultiSelectOption<O>) => {
    const on = selected.includes(opt.value);
    if (!on && opt.muted && opt.confirm && !window.confirm(opt.confirm)) return;
    onChange(on ? selected.filter((s) => s !== opt.value) : [...selected, opt.value]);
  };

  const summaryNode = summary
    ? summary(selected)
    : selected.length === 0
      ? <span className="text-ink-faint">{placeholder}</span>
      : selected.join(", ");

  return (
    <div ref={ref} className={["relative", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth: width }}
        className={[
          "flex w-full items-center gap-1.5 rounded-md border bg-surface px-2 py-1 text-left text-sm outline-none transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          open ? "border-accent" : "border-line hover:border-line-strong",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">{summaryNode}</span>
        {selected.length > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold tabular-nums text-accent">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`shrink-0 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
          {opts.length === 0 && <div className="px-2 py-1.5 text-xs text-ink-faint">No options.</div>}
          {opts.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt)}
                className={[
                  "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-canvas",
                  opt.muted ? "opacity-55" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold",
                    on ? "border-accent bg-accent text-accent-fg" : "border-line-strong text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
                <span className="flex-1 font-medium text-ink">{opt.label ?? opt.value}</span>
                {opt.hint != null && <span className="shrink-0 text-[11px] text-ink-faint">{opt.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
