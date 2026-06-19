/**
 * Closeout-readiness rules (F3 → X1). "How close is this contract to closeable,
 * and what's unmet?" is just the completeness rules run over a contract — no new
 * data, pure rules over the world.
 */
import type { Contract, InventoryItem, PayItem, Authorization } from "@/domain/types";
import { type RuleResult, blocker, warning } from "./types";

export interface CloseoutContext {
  items: InventoryItem[];
  payItems: PayItem[];
  authorizations: Authorization[];
  /** unsigned past diary days (optional; from the diary range). */
  unsignedDiaryCount?: number;
}

export function closeoutRules(contract: Contract, ctx: CloseoutContext): RuleResult[] {
  const cid = contract.id;
  const base = `/contract/${cid}`;
  const results: RuleResult[] = [];

  // Inventory — everything reviewed.
  const notComplete = ctx.items.filter((i) => i.status !== "Review Complete").length;
  results.push(
    blocker(
      "closeout.inventory-reviewed",
      notComplete === 0,
      notComplete === 0
        ? "All inventory reviewed"
        : `${notComplete} inventory item${notComplete === 1 ? "" : "s"} not yet Review Complete`,
      cid,
      `${base}/inventory`,
    ),
  );

  // Pay items — all finaled.
  const openItems = ctx.payItems.filter((p) => !p.final).length;
  results.push(
    blocker(
      "closeout.pay-items-final",
      openItems === 0,
      openItems === 0 ? "All pay items final" : `${openItems} pay item${openItems === 1 ? "" : "s"} not finaled`,
      cid,
      `${base}/quantity-book`,
    ),
  );

  // Authorizations — none left open.
  const openAuths = ctx.authorizations.filter((a) => a.status !== "Published").length;
  results.push(
    blocker(
      "closeout.authorizations-closed",
      openAuths === 0,
      openAuths === 0 ? "All authorizations published" : `${openAuths} open authorization${openAuths === 1 ? "" : "s"}`,
      cid,
      `${base}/authorizations`,
    ),
  );

  if (ctx.unsignedDiaryCount !== undefined) {
    results.push(
      warning(
        "closeout.diaries-signed",
        ctx.unsignedDiaryCount === 0,
        ctx.unsignedDiaryCount === 0
          ? "All past diaries signed"
          : `${ctx.unsignedDiaryCount} unsigned diary day${ctx.unsignedDiaryCount === 1 ? "" : "s"}`,
        cid,
        `${base}/diary`,
      ),
    );
  }

  // Final Review — the closeout tracker fields.
  const fr = contract.finalReview;
  results.push(
    blocker(
      "closeout.all-pay-items-final-flag",
      !!fr.finalFromDistrict.allPayItemsFinal,
      fr.finalFromDistrict.allPayItemsFinal ? "Final Review: all pay items marked final" : "Final Review: 'All Pay Items are Final' not checked",
      cid,
      base,
    ),
  );
  results.push(
    blocker(
      "closeout.materials-cert",
      !!fr.materialsReview.materialsCertDate,
      fr.materialsReview.materialsCertDate ? "Materials certification recorded" : "Materials Certification date missing",
      cid,
      base,
    ),
  );
  results.push(
    blocker(
      "closeout.final-inspection",
      !!fr.finalFromDistrict.finalInspectionBc71,
      fr.finalFromDistrict.finalInspectionBc71 ? "Final Inspection BC-71 recorded" : "Final Inspection BC-71 missing",
      cid,
      base,
    ),
  );
  results.push(
    warning(
      "closeout.dbe",
      !!fr.dbeCloseOut.approved && (fr.dbeCloseOut.goalMet || fr.dbeCloseOut.waiverGranted),
      fr.dbeCloseOut.approved && (fr.dbeCloseOut.goalMet || fr.dbeCloseOut.waiverGranted)
        ? "DBE closeout complete"
        : "DBE closeout incomplete (approval / goal or waiver)",
      cid,
      base,
    ),
  );
  results.push(
    blocker(
      "closeout.state-completion",
      !!fr.finalFromDistrict.stateCompletionNotice,
      fr.finalFromDistrict.stateCompletionNotice ? "State Completion Notice issued" : "State Completion Notice missing",
      cid,
      base,
    ),
  );

  return results;
}

/**
 * M3 — the operational "ready to final out" gate: the inventory / pay-item /
 * authorization blockers that must pass before a contract can be finaled out.
 * (The Final-Review fields are what final-out then sets, so they're excluded.)
 */
const FINAL_OUT_RULES = new Set(["closeout.inventory-reviewed", "closeout.pay-items-final", "closeout.authorizations-closed"]);
export function finalOutGate(contract: Contract, ctx: CloseoutContext): RuleResult[] {
  return closeoutRules(contract, ctx).filter((r) => FINAL_OUT_RULES.has(r.id));
}
export function canFinalOut(contract: Contract, ctx: CloseoutContext): boolean {
  return finalOutGate(contract, ctx).every((r) => r.ok);
}

/** Score = share of satisfied non-info rules (0–100). */
export function closeoutScore(results: RuleResult[]): number {
  const graded = results.filter((r) => r.severity !== "info");
  if (graded.length === 0) return 100;
  const ok = graded.filter((r) => r.ok).length;
  return Math.round((ok / graded.length) * 100);
}

/** The unmet items, blockers first, for the "what's left" checklist. */
export function unmet(results: RuleResult[]): RuleResult[] {
  const order: Record<string, number> = { blocker: 0, warning: 1, info: 2 };
  return results.filter((r) => !r.ok).sort((a, b) => order[a.severity] - order[b.severity]);
}
