import { useStore } from "@/store/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          aria-live={t.kind === "error" ? "assertive" : "polite"}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-left text-sm shadow-lg transition",
            t.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : t.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-slate-200 bg-white text-slate-700",
          ].join(" ")}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
