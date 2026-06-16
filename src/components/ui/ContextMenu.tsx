import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // keep on screen
  const left = Math.min(x, window.innerWidth - 232);
  const top = Math.min(y, window.innerHeight - items.length * 34 - 12);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-xl"
      style={{ left, top }}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-line" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
            className={[
              "block w-full px-3 py-1.5 text-left text-sm transition",
              it.disabled
                ? "cursor-not-allowed text-ink-faint"
                : it.danger
                  ? "text-red-700 hover:bg-red-50"
                  : "text-ink hover:bg-accent-soft",
            ].join(" ")}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
