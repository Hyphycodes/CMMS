import { useState } from "react";
import { ChevronDown } from "@/components/ui/icons";
import { type Field, formatField, isEmptyValue } from "@/lib/fields";

export function FieldGroup({
  title,
  fields,
  showEmpty = false,
  defaultOpen = true,
  collapsible = true,
  columns = 3,
  children,
}: {
  title: string;
  fields: Field[];
  showEmpty?: boolean;
  defaultOpen?: boolean;
  /** Set false to render as a static section with no collapse toggle. */
  collapsible?: boolean;
  columns?: 2 | 3 | 4;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  const visible = fields.filter((f) => showEmpty || !isEmptyValue(f.value));
  const hiddenCount = fields.length - visible.length;
  const colClass =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      {collapsible ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-canvas"
          aria-expanded={isOpen}
        >
          <ChevronDown className={["text-base text-ink-faint transition", isOpen ? "" : "-rotate-90"].join(" ")} />
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="text-xs text-ink-faint">{visible.length} fields</span>
          {!showEmpty && hiddenCount > 0 && (
            <span className="ml-auto text-xs text-ink-faint">{hiddenCount} empty hidden</span>
          )}
        </button>
      ) : (
        <div className="px-4 py-3">
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
      )}
      {isOpen && (
        <div className={["grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line px-4 py-4", colClass].join(" ")}>
          {visible.map((f) => (
            <div key={f.label} className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{f.label}</div>
              <div
                className={["truncate text-sm text-ink", f.type === "mono" ? "font-mono" : ""].join(" ")}
                title={formatField(f.value, f.type)}
              >
                {formatField(f.value, f.type)}
              </div>
            </div>
          ))}
          {visible.length === 0 && !children && (
            <p className="text-sm text-ink-faint">All fields in this section are empty.</p>
          )}
          {children && <div className="col-span-full">{children}</div>}
        </div>
      )}
    </section>
  );
}
