/**
 * Risk radar rules (F3 → X2) — the rules layer run *forward*: "what's about to
 * bite me." Insurance expiring, overage nearing the authorization threshold,
 * placed-but-unapproved EOI, completion-date proximity with open items.
 */
import type { Contract, InventoryItem, PayItem, Sample } from "@/domain/types";
import { type RuleResult, warning, info } from "./types";

export interface RadarContext {
  contract: Contract;
  items: InventoryItem[];
  payItems: PayItem[];
  samples: Sample[];
  /** epoch ms "now" — injectable for tests */
  now?: number;
}

const DAY = 86_400_000;
const daysUntil = (iso: string | null, now: number): number | null =>
  iso ? Math.round((new Date(iso + "T00:00:00").getTime() - now) / DAY) : null;

export function radarRules(ctx: RadarContext): RuleResult[] {
  const now = ctx.now ?? Date.now();
  const c = ctx.contract;
  const base = `/contract/${c.id}`;
  const out: RuleResult[] = [];

  // Insurance / policy expirations.
  for (const pol of c.insurance.policies) {
    const d = daysUntil(pol.expiration, now);
    if (d !== null && d <= 45) {
      out.push(
        warning(
          "radar.insurance-expiring",
          false,
          d < 0
            ? `${pol.kind} insurance expired ${Math.abs(d)}d ago`
            : `${pol.kind} insurance expires in ${d}d`,
          c.id,
          base,
        ),
      );
    }
  }

  // Overage approaching the authorization threshold (placed vs. awarded).
  for (const p of ctx.payItems) {
    if (p.awardedQuantity <= 0) continue;
    const ratio = p.placedQuantity / p.awardedQuantity;
    if (ratio >= 1) {
      out.push(
        warning(
          "radar.overage",
          false,
          `Pay item ${p.number} over awarded (${Math.round(ratio * 100)}%) — needs authorization`,
          c.id,
          `${base}/quantity-book?payItem=${p.number}`,
        ),
      );
    } else if (ratio >= 0.9) {
      out.push(
        info(
          "radar.overage-approaching",
          false,
          `Pay item ${p.number} at ${Math.round(ratio * 100)}% of awarded`,
          c.id,
          `${base}/quantity-book?payItem=${p.number}`,
        ),
      );
    }
  }

  // Placed-but-unapproved: inventory waiting on review, aging.
  const stale = ctx.items.filter(
    (i) => i.status === "Ready for Review" && i.readyAt !== null && now - i.readyAt >= 14 * DAY,
  ).length;
  if (stale > 0) {
    out.push(
      warning(
        "radar.eoi-aging",
        false,
        `${stale} inventory item${stale === 1 ? "" : "s"} waiting on review > 2 weeks`,
        c.id,
        `${base}/inventory`,
      ),
    );
  }

  // Completion-date proximity with open items.
  const dComplete = daysUntil(c.summary.contractCompletionDate, now);
  const openItems = ctx.items.filter((i) => i.status !== "Review Complete").length;
  if (dComplete !== null && dComplete <= 30 && openItems > 0) {
    out.push(
      warning(
        "radar.completion-proximity",
        false,
        dComplete < 0
          ? `Completion date passed ${Math.abs(dComplete)}d ago with ${openItems} open item${openItems === 1 ? "" : "s"}`
          : `Completion in ${dComplete}d with ${openItems} open item${openItems === 1 ? "" : "s"}`,
        c.id,
        base,
      ),
    );
  }

  return out;
}

/** Urgency rank for sorting radar results (blocker > warning > info, expired first). */
export function radarUrgency(r: RuleResult): number {
  const sev = r.severity === "warning" ? 1 : 2;
  const expired = /expired|passed|over awarded/.test(r.message) ? 0 : 1;
  return sev * 10 + expired;
}
