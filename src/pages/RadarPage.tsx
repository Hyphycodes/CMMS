/**
 * X2 — Risk radar: the rules layer (F3) run *forward* across the user's scope.
 * "What's about to bite me" — insurance expiring, overage nearing the
 * authorization threshold, placed-but-unapproved EOI aging, completion-date
 * proximity with open items. Each warning links to the fix.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { radarRules, radarUrgency, type RuleResult } from "@/domain/rules";
import { Pill } from "@/components/ui/Pill";

export function RadarPage() {
  const navigate = useNavigate();
  const contracts = useStore((s) => s.contracts);
  const visibleIds = useStore((s) => s.visibleIds);
  const items = useStore((s) => s.items);
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const samplesList = useStore((s) => s.samplesList);

  const results = useMemo(() => {
    const now = Date.now();
    const out: { r: RuleResult; contractNumber: string }[] = [];
    for (const c of contracts) {
      if (!visibleIds.has(c.id)) continue;
      const rs = radarRules({
        contract: c,
        items: items.filter((i) => i.contractId === c.id),
        payItems: payItemsByContract.get(c.id) ?? [],
        samples: samplesList.filter((s) => s.contractId === c.id),
        now,
      });
      for (const r of rs) out.push({ r, contractNumber: c.number });
    }
    return out.sort((a, b) => radarUrgency(a.r) - radarUrgency(b.r));
  }, [contracts, visibleIds, items, payItemsByContract, samplesList]);

  const warnings = results.filter((x) => x.r.severity === "warning");
  const infos = results.filter((x) => x.r.severity === "info");

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Risk Radar</h1>
          <p className="text-sm text-ink-soft">What's about to go wrong across your projects, ranked by urgency.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Warnings" value={warnings.length} tone={warnings.length ? "amber" : "slate"} />
          <Stat label="Heads-up" value={infos.length} />
          <Stat label="Projects in scope" value={visibleIds.size} />
        </div>

        <section className="rounded-card border border-line bg-surface">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">Nothing on the radar — all clear across your scope.</p>
          ) : (
            <ul className="divide-y divide-line">
              {results.map(({ r, contractNumber }, i) => (
                <li key={`${r.id}-${r.subjectId}-${i}`}>
                  <button
                    onClick={() => r.href && navigate(r.href)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas"
                  >
                    <Pill tone={r.severity === "warning" ? "amber" : "slate"}>{r.severity === "warning" ? "Warning" : "Heads-up"}</Pill>
                    <span className="font-mono text-xs font-semibold text-ink">{contractNumber}</span>
                    <span className="min-w-0 flex-1 text-sm text-ink-soft">{r.message}</span>
                    {r.href && <span className="text-xs text-accent">Fix →</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
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
