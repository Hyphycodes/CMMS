/**
 * Test ID picker for an Evidence-of-Inspection row. Shows the *real* Test IDs
 * that match the inventory's material AND producer (PDF p.8 — "the approved Test
 * ID for that producer and material"), with a "none" option for certs-only rows.
 *
 * Each option carries its live remaining/capacity (computed from sample quantity
 * minus everything already tied to it). A Test ID whose sample quantity is used
 * up shows grayed with a "0 of 500 TON left" badge — still pickable (a cert can
 * legitimately cover more than one sample) but behind a quick confirm. A Test ID
 * whose sample is already decided (Approved/Rejected) stays locked.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "@/components/ui/icons";
import type { TestIdUsage } from "@/domain/rules/testIdUsage";
import { formatNumber } from "@/lib/format";

export function TestIdSelect({
  value,
  options,
  usage,
  disabled,
  locked,
  onChange,
}: {
  value: string;
  options: string[];
  usage: Map<string, TestIdUsage>;
  disabled?: boolean;
  locked?: boolean;
  onChange: (v: string) => void;
}) {
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

  // Make sure the current value is always selectable even if it's no longer in
  // the candidate match list (e.g. a locked / legacy tie).
  const ids = value && !options.includes(value) ? [value, ...options] : options;

  const badgeFor = (id: string) => {
    const u = usage.get(id);
    if (!u || u.capacity <= 0) return null;
    return `${formatNumber(Math.max(0, u.remaining), 0)} of ${formatNumber(u.capacity, 0)} ${u.unit} left`;
  };
  const usedUp = (id: string) => {
    const u = usage.get(id);
    return !!u && u.usedUp;
  };

  const pick = (id: string) => {
    if (id && usedUp(id) && id !== value) {
      if (!window.confirm(`Test ID ${id} is used up (${badgeFor(id) ?? "0 left"}). Tie it anyway?`)) return;
    }
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || locked}
        title={locked ? "Locked — the linked sample has been approved/rejected" : undefined}
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex w-32 items-center gap-1.5 rounded-md border bg-surface px-2 py-1 text-left font-mono text-sm outline-none transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          open ? "border-accent" : "border-line hover:border-line-strong",
          value && usedUp(value) ? "text-red-600" : "",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">{value || <span className="text-ink-faint">— none —</span>}</span>
        <ChevronDown className={`shrink-0 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && !locked && (
        <div className="absolute left-0 z-50 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
          <button
            type="button"
            onClick={() => pick("")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-canvas"
          >
            <span className="flex-1 text-ink-soft">— none (certs only) —</span>
            {value === "" && <span className="text-accent">●</span>}
          </button>
          {ids.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-ink-faint">No matching Test IDs for this material + producer.</div>
          )}
          {ids.map((id) => {
            const isUsedUp = usedUp(id);
            const badge = badgeFor(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className={[
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-canvas",
                  isUsedUp ? "opacity-55" : "",
                ].join(" ")}
              >
                <span className={["flex-1 truncate font-mono font-medium", isUsedUp ? "text-red-600" : "text-ink"].join(" ")}>
                  {id}
                </span>
                {badge && (
                  <span className={["shrink-0 text-[11px] tabular-nums", isUsedUp ? "text-red-600" : "text-ink-faint"].join(" ")}>
                    {badge}
                  </span>
                )}
                {value === id && <span className="shrink-0 text-accent">●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
