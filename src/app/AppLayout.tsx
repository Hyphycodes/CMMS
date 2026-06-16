import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useStore } from "@/store/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Toasts } from "@/components/ui/Toasts";
import { LoadingScreen } from "@/components/ui/Loading";

export function AppLayout() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const load = useStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "idle" || status === "loading") {
    return <LoadingScreen message="Loading contracts…" />;
  }
  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold text-red-700">Couldn't load data</p>
        <p className="max-w-md text-sm text-ink-soft">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[252px_1fr] grid-rows-[56px_1fr]">
      <Header />
      <Sidebar />
      <main className="min-h-0 overflow-hidden bg-canvas">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}
