/**
 * X1 — closeout-readiness score + unmet checklist. Pure view over the rules layer
 * (F3 closeoutRules): "how close is this contract to closeable, and what's unmet?"
 */
import { useMemo } from "react";
import { useStore } from "@/store/store";
import { useNavigate } from "react-router-dom";
import type { Contract } from "@/domain/types";
import { closeoutRules, closeoutScore, unmet } from "@/domain/rules";

function useCloseout(contract: Contract) {
  const items = useStore((s) => s.items);
  const payItemsByContract = useStore((s) => s.payItemsByContract);
  const authorizationsList = useStore((s) => s.authorizationsList);
  return useMemo(() => {
    const results = closeoutRules(contract, {
      items: items.filter((i) => i.contractId === contract.id),
      payItems: payItemsByContract.get(contract.id) ?? [],
      authorizations: authorizationsList.filter((a) => a.contractId === contract.id),
    });
    return { score: closeoutScore(results), unmet: unmet(results) };
  }, [contract, items, payItemsByContract, authorizationsList]);
}

const tone = (score: number) =>
  score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

export function CloseoutScoreChip({ contract }: { contract: Contract }) {
  const { score, unmet } = useCloseout(contract);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone(score)}`} title={`${unmet.length} item(s) unmet`}>
      {score}% closeout-ready
    </span>
  );
}

export function CloseoutChecklist({ contract }: { contract: Contract }) {
  const navigate = useNavigate();
  const { score, unmet } = useCloseout(contract);
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-ink">Closeout Readiness</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone(score)}`}>{score}%</span>
        <span className="text-xs text-ink-faint">{unmet.length} unmet</span>
      </div>
      {unmet.length === 0 ? (
        <p className="text-sm text-emerald-700">Everything tracked is satisfied — ready to close out.</p>
      ) : (
        <ul className="space-y-1">
          {unmet.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span className={r.severity === "blocker" ? "text-red-600" : "text-amber-600"}>○</span>
              {r.href ? (
                <button onClick={() => navigate(r.href!)} className="text-left text-ink-soft hover:text-accent hover:underline">{r.message}</button>
              ) : (
                <span className="text-ink-soft">{r.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
