/**
 * Role-aware landing (brief 02). The index route ("/") sends each user to the
 * home that fits their job — inspectors/RE never land in the documentation queue.
 */
import { useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { InboxPage } from "@/pages/InboxPage";
import { Pill } from "@/components/ui/Pill";
import { PlusIcon } from "@/components/ui/icons";
import { landingFor, ROLE_LABELS } from "@/auth/permissions";

export function HomePage() {
  const currentUser = useStore((s) => s.currentUser);
  const landing = landingFor(currentUser);

  if (landing === "inbox") return <InboxPage />;
  if (landing === "my-contracts") return <MyContractsHome />;
  if (landing === "my-day") return <MyDayHome />;
  return <ContractorHome />;
}

function Greeting({ subtitle }: { subtitle: string }) {
  const user = useStore((s) => s.currentUser);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">
        {user ? `Welcome, ${user.name}` : "Welcome"}
      </h1>
      <p className="text-sm text-ink-soft">
        {user && <span className="font-medium text-accent">{ROLE_LABELS[user.roles[0]]}</span>} · {subtitle}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
    </div>
  );
}

// --- Resident Engineer: My Contracts ---------------------------------------

function MyContractsHome() {
  const contracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const items = useStore((s) => s.items);

  const rows = useMemo(() => {
    const open = new Map<string, number>();
    for (const it of items) {
      if (!visibleIds.has(it.contractId)) continue;
      if (it.status === "Needs Attention") open.set(it.contractId, (open.get(it.contractId) ?? 0) + 1);
    }
    return contracts
      .filter((c) => visibleIds.has(c.id))
      .map((c) => ({ c, open: open.get(c.id) ?? 0 }))
      .sort((a, b) => b.c.readyForReviewCount - a.c.readyForReviewCount);
  }, [contracts, visibleIds, items]);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 py-6">
      <Greeting subtitle="your contracts, busiest first." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ c, open }) => (
          <Link
            key={c.id}
            to={`/contract/${c.id}`}
            className="rounded-card border border-line bg-surface p-4 transition hover:border-accent hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-accent">{c.number}</span>
              <Pill tone={c.summary.contractStatus === "Active" ? "green" : "slate"}>
                {c.summary.contractStatus}
              </Pill>
            </div>
            <div className="mt-0.5 truncate text-sm text-ink" title={c.name}>{c.name}</div>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-ink-soft">
                <span className="font-semibold tabular-nums text-blue-700">{c.readyForReviewCount}</span> ready
              </span>
              <span className="text-ink-soft">
                <span className="font-semibold tabular-nums text-amber-700">{open}</span> needs attention
              </span>
              <span className="ml-auto text-ink-faint tabular-nums">{c.inventoryCount} items</span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-soft">No contracts are assigned to you.</p>}
      </div>
    </div>
  );
}

// --- Inspector: My Day ------------------------------------------------------

function MyDayHome() {
  const items = useStore((s) => s.items);
  const visibleIds = useStore((s) => s.visibleIds);
  const contractsById = useStore((s) => s.contractsById);
  const samplesList = useStore((s) => s.samplesList);
  const navigate = useNavigate();

  const myInventory = useMemo(
    () =>
      items
        .filter((i) => visibleIds.has(i.contractId) && i.status === "Needs Attention")
        .slice(0, 200),
    [items, visibleIds],
  );
  const readyCount = useMemo(
    () => items.filter((i) => visibleIds.has(i.contractId) && i.status === "Ready for Review").length,
    [items, visibleIds],
  );
  const openSamples = useMemo(
    () =>
      samplesList.filter(
        (sm) =>
          (sm.contractId === null || visibleIds.has(sm.contractId)) &&
          sm.status !== "Approved" &&
          sm.status !== "Rejected",
      ),
    [samplesList, visibleIds],
  );

  const firstContract = [...visibleIds][0];

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Greeting subtitle="what needs you today." />
        <div className="flex gap-2">
          <Link
            to="/samples?new=1"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            <PlusIcon className="text-base" /> New Sample
          </Link>
          {firstContract && (
            <button
              onClick={() => navigate(`/contract/${firstContract}/inventory?new=1`)}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-canvas"
            >
              <PlusIcon className="text-base" /> New Inventory
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={visibleIds.size} label="my contracts" />
        <Stat value={myInventory.length} label="inventory needs attention" />
        <Stat value={readyCount} label="ready for review" />
        <Stat value={openSamples.length} label="open samples" />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-faint">
        Inventory not yet Ready for Review
      </h2>
      <div className="mt-2 overflow-hidden rounded-card border border-line bg-surface">
        {myInventory.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">Nothing waiting on you. 🎉</p>
        ) : (
          myInventory.slice(0, 40).map((it) => (
            <button
              key={it.id}
              onClick={() => navigate(`/contract/${it.contractId}/inventory/${it.id}`)}
              className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-canvas"
            >
              <span className="font-mono text-xs text-ink-faint">{contractsById.get(it.contractId)?.number}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-mono font-semibold">{it.materialCode}</span>
                <span className="mx-1.5 text-ink-faint">—</span>
                {it.materialName}
              </span>
              <Pill tone="amber">{it.status}</Pill>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// --- Contractor: own contract read view -------------------------------------

function ContractorHome() {
  const visibleIds = useStore((s) => s.visibleIds);
  const first = [...visibleIds][0];
  if (first) return <Navigate to={`/contract/${first}`} replace />;
  return (
    <div className="grid h-full place-items-center text-sm text-ink-soft">
      No contracts are shared with you yet.
    </div>
  );
}
