/**
 * The intelligent typeahead — type a partial code OR name and get a *columned*
 * dropdown that filters as you type. Generic over any item; keyboard-navigable.
 * This is the single material/vendor/pay-item picker reused everywhere (briefs
 * 03, 05, 08, 11) — never copied per module.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SearchIcon, XIcon } from "@/components/ui/icons";

export interface SearchColumn<T> {
  header: string;
  get: (item: T) => string;
  grow?: boolean;
  mono?: boolean;
}

interface Props<T> {
  items: T[];
  columns: SearchColumn<T>[];
  getKey: (item: T) => string;
  /** the haystack searched as you type (code + name + unit + …). */
  getSearchText: (item: T) => string;
  onSelect: (item: T) => void;
  /** current display value (e.g. the chosen item's label). */
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
  ariaLabel?: string;
  allowClear?: boolean;
  onClear?: () => void;
}

export function IntelligentSearch<T>({
  items,
  columns,
  getKey,
  getSearchText,
  onSelect,
  value = "",
  placeholder = "Type to search…",
  disabled = false,
  maxResults = 50,
  ariaLabel,
  allowClear = false,
  onClear,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Precompute lowercased haystacks once per item set.
  const haystacks = useMemo(
    () => items.map((it) => ({ it, hay: getSearchText(it).toLowerCase() })),
    [items, getSearchText],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return haystacks.slice(0, maxResults).map((h) => h.it);
    const tokens = needle.split(/\s+/);
    const out: T[] = [];
    for (const { it, hay } of haystacks) {
      if (tokens.every((t) => hay.includes(t))) {
        out.push(it);
        if (out.length >= maxResults) break;
      }
    }
    return out;
  }, [haystacks, query, maxResults]);

  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (item: T) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // keep active row in view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const template = columns.map((c) => (c.grow ? "minmax(0,2fr)" : "minmax(0,1fr)")).join(" ");

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={[
          "flex items-center gap-2 rounded-lg border bg-canvas px-3 py-2 text-sm transition",
          disabled ? "border-line opacity-60" : "border-line focus-within:border-accent",
        ].join(" ")}
      >
        <SearchIcon className="text-base text-ink-faint" />
        <input
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : query || value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value || placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-faint"
        />
        {allowClear && value && !disabled && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              onClear?.();
              setQuery("");
            }}
            className="rounded p-0.5 text-ink-faint hover:text-ink"
          >
            <XIcon className="text-sm" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          ref={listRef}
          className="scroll-thin absolute z-50 mt-1 max-h-72 w-full min-w-[360px] overflow-y-auto rounded-lg border border-line bg-surface shadow-xl"
        >
          <div
            className="sticky top-0 grid gap-3 border-b border-line bg-canvas px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => (
              <span key={c.header} className="truncate">{c.header}</span>
            ))}
          </div>
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink-faint">No matches.</p>
          ) : (
            results.map((item, i) => (
              <button
                type="button"
                key={getKey(item)}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                className={[
                  "grid w-full gap-3 px-3 py-2 text-left text-sm transition",
                  i === active ? "bg-accent-soft" : "hover:bg-canvas",
                ].join(" ")}
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((c, ci) => (
                  <span
                    key={c.header}
                    className={[
                      "truncate",
                      ci === 0 ? "font-medium text-ink" : "text-ink-soft",
                      c.mono ? "font-mono text-[13px]" : "",
                    ].join(" ")}
                  >
                    {c.get(item) || "—"}
                  </span>
                ))}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
