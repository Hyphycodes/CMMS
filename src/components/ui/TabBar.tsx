/**
 * Underline tab strip with optional count badges. Extracted from the inventory
 * drawer so every record detail / contract node shares one tab look.
 */
export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={["flex gap-1 border-b border-line", className].join(" ")}
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={[
              "relative px-3 py-2.5 text-sm font-medium transition",
              selected ? "text-accent" : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs text-ink-faint tabular-nums">{t.count}</span>
            )}
            {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
