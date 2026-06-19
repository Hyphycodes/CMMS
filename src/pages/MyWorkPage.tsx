/**
 * P2 — "My Work" landing dashboard. A personal lens over the one canonical
 * dataset (P1 assignment + F2 provenance): My Projects, Created by me, Assigned
 * by me, Waiting on me. Every row deep-links to the shared record (P3) — no
 * per-user copy is read or written.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { Pill } from "@/components/ui/Pill";
import { sampleTone } from "@/domain/status";
import { formatWaiting, waitingTone } from "@/lib/format";
import { closeoutRules, closeoutScore } from "@/domain/rules";

export function MyWorkPage() {
  const navigate = useNavigate();
  const contracts = useStore((s) => s.contracts);
  const items = useStore((s) => s.items);
  const samplesList = useStore((s) => s.samplesList);
  const visibleIds = useStore((s) => s.visibleIds);
  const viewAsUserId = useStore((s) => s.viewAsUserId);
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const setViewAs = useStore((s) => s.setViewAs);
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const authorizationsList = useStore((s) => s.authorizationsList);

  const lensUserId = viewAsUserId ?? currentUser?.id ?? "";
  const lensUser = users.find((u) => u.id === lensUserId) ?? currentUser;
  const lensName = lensUser?.name ?? "";

  // P1 lens — assigned contracts; admin/doc (no assignment) fall back to visible.
  const projects = useMemo(() => {
    const assigned = contracts.filter((c) => c.assignedInspectorIds?.includes(lensUserId));
    return assigned.length ? assigned : contracts.filter((c) => visibleIds.has(c.id));
  }, [contracts, lensUserId, visibleIds]);

  // Created by me — samples I logged (F2 provenance createdBy).
  const createdSamples = useMemo(
    () => samplesList.filter((s) => s.createdBy === lensName).slice(0, 50),
    [samplesList, lensName],
  );
  // Assigned by me — inventory I created/assigned.
  const assignedItems = useMemo(
    () => items.filter((i) => i.createdBy === lensName).slice(0, 50),
    [items, lensName],
  );
  // Waiting on me — Ready for Review in my scope, oldest first.
  const now = Date.now();
  const waiting = useMemo(
    () =>
      items
        .filter((i) => i.status === "Ready for Review" && visibleIds.has(i.contractId))
        .map((i) => ({ ...i, waitingMs: i.readyAt ? now - i.readyAt : 0 }))
        .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0))
        .slice(0, 50),
    [items, visibleIds, now],
  );

  const inspectors = users.filter((u) => u.roles.includes("Inspector") || u.roles.includes("ResidentEngineer"));
  const canSwitchLens = !!currentUser && (currentUser.roles.includes("Documentation") || currentUser.roles.includes("DistrictAdmin") || currentUser.roles.includes("ResidentEngineer"));

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-ink">My Work</h1>
            <p className="text-sm text-ink-soft">Your projects, what you've touched, and what's waiting on you.</p>
          </div>
          {canSwitchLens && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Viewing lens:
              <select
                value={viewAsUserId ?? currentUser?.id ?? ""}
                onChange={(e) => setViewAs(e.target.value === (currentUser?.id ?? "") ? null : e.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-sm font-medium text-ink outline-none"
              >
                {inspectors.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.id === currentUser?.id ? " (me)" : ""}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="My Projects" value={projects.length} />
          <Stat label="Created by me" value={createdSamples.length} />
          <Stat label="Assigned by me" value={assignedItems.length} />
          <Stat label="Waiting on me" value={waiting.length} tone={waiting.length > 0 ? "amber" : "slate"} />
        </div>

        <Section title={`My Projects (${projects.length})`}>
          {projects.length === 0 ? (
            <Empty>No projects assigned to this lens.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {projects.slice(0, 30).map((c) => {
                const score = closeoutScore(
                  closeoutRules(c, {
                    items: items.filter((i) => i.contractId === c.id),
                    payItems: payItemsByContract.get(c.id) ?? [],
                    authorizations: authorizationsList.filter((a) => a.contractId === c.id),
                  }),
                );
                return (
                  <li key={c.id}>
                    <button onClick={() => navigate(`/contract/${c.id}`)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-canvas">
                      <span className="font-mono text-sm font-semibold text-ink">{c.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{c.name}</span>
                      {c.readyForReviewCount > 0 && <Pill tone="blue">{c.readyForReviewCount} to review</Pill>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                        {score}% closeout
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={`Waiting on me (${waiting.length})`}>
            {waiting.length === 0 ? (
              <Empty>Nothing waiting on you.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {waiting.slice(0, 20).map((i) => (
                  <li key={i.id}>
                    <button onClick={() => navigate(`/contract/${i.contractId}/inventory/${i.id}`)} className="flex w-full items-center gap-2 px-1 py-2 text-left hover:bg-canvas">
                      <span className="font-mono text-[13px] font-semibold text-ink">{i.materialCode}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{i.materialName}</span>
                      <span className="text-xs text-ink-faint">{i.contractNumber}</span>
                      <Pill tone={waitingTone(i.waitingMs)}>{formatWaiting(i.waitingMs)}</Pill>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Created by me — samples (${createdSamples.length})`}>
            {createdSamples.length === 0 ? (
              <Empty>No samples created in this lens.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {createdSamples.slice(0, 20).map((s) => (
                  <li key={s.id}>
                    <button onClick={() => navigate(`/samples/${s.id}`)} className="flex w-full items-center gap-2 px-1 py-2 text-left hover:bg-canvas">
                      <span className="font-mono text-[13px] font-semibold text-ink">{s.testId || s.sampleIdentifier}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{s.materialName}</span>
                      <Pill tone={sampleTone(s.status)}>{s.status}</Pill>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title={`Assigned by me — inventory (${assignedItems.length})`}>
          {assignedItems.length === 0 ? (
            <Empty>No inventory created in this lens.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {assignedItems.slice(0, 24).map((i) => (
                <li key={i.id}>
                  <button onClick={() => navigate(`/contract/${i.contractId}/inventory/${i.id}`)} className="flex w-full items-center gap-2 px-1 py-2 text-left hover:bg-canvas">
                    <span className="font-mono text-[13px] font-semibold text-ink">{i.materialCode}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{i.materialName}</span>
                    <span className="text-xs text-ink-faint">{i.contractNumber}</span>
                    <Pill tone={i.status ? "blue" : "slate"}>{i.status ?? "—"}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${tone === "amber" && value > 0 ? "text-amber-600" : "text-ink"}`}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-sm text-ink-faint">{children}</p>;
}
