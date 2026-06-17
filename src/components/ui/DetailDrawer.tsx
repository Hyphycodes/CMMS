/**
 * Reusable right-hand slide-over: eyebrow + title + subtitle, an actions slot
 * (status control), a TabBar, and children. Esc closes; click-scrim closes.
 * Generalized from the inventory detail drawer — the reference for every record
 * detail (samples, etc.).
 */
import { useEffect, useRef } from "react";
import { TabBar, type TabDef } from "@/components/ui/TabBar";
import { XIcon } from "@/components/ui/icons";

interface Props<T extends string> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: TabDef<T>[];
  activeTab: T;
  onTabChange: (id: T) => void;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function DetailDrawer<T extends string>({
  eyebrow,
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
  width = 760,
}: Props<T>) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full flex-col bg-surface shadow-2xl outline-none"
        style={{ width, maxWidth: "94vw" }}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="flex items-center gap-2">{eyebrow}</div>}
            <h2 className="mt-1 truncate text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
          </div>
          {actions}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-faint hover:bg-canvas"
          >
            <XIcon className="text-xl" />
          </button>
        </div>

        <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} className="px-3" />

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
