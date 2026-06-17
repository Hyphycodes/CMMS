import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { SearchIcon, XIcon } from "@/components/ui/icons";

/** Type-to-filter over all ~200 contracts. No pagination. */
export function ContractSelector({ onClose }: { onClose: () => void }) {
  const allContracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const contracts = useMemo(
    () => allContracts.filter((c) => visibleIds.has(c.id)),
    [allContracts, visibleIds],
  );
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? contracts.filter(
          (c) =>
            c.number.toLowerCase().includes(needle) ||
            c.name.toLowerCase().includes(needle) ||
            c.county.toLowerCase().includes(needle) ||
            c.workType.toLowerCase().includes(needle),
        )
      : contracts;
    return list.slice(0, 200);
  }, [q, contracts]);

  const choose = (id: string) => {
    navigate(`/contract/${id}/inventory`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 pt-[12vh]" onClick={onClose}>
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <SearchIcon className="text-lg text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contracts by number, county, or work type…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-faint"
          />
          <button onClick={onClose} className="rounded p-1 text-ink-faint hover:bg-canvas">
            <XIcon className="text-lg" />
          </button>
        </div>
        <div className="scroll-thin max-h-[52vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">No contracts match “{q}”.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => choose(c.id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-accent-soft"
            >
              <span className="w-14 font-mono text-sm font-semibold text-accent">{c.number}</span>
              <span className="flex-1 truncate text-sm text-ink">{c.name}</span>
              {c.readyForReviewCount > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700">
                  {c.readyForReviewCount} ready
                </span>
              )}
              <span className="w-16 text-right text-xs tabular-nums text-ink-faint">
                {c.inventoryCount} items
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
