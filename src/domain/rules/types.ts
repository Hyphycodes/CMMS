/**
 * F3 — Rules layer. Each rule is a pure function `(entity, context) => RuleResult`.
 * Closeout scoring (X1) and the risk radar (X2) are these same rules run over the
 * dataset, so the engine is built once and consumed everywhere.
 */

export type RuleSeverity = "blocker" | "warning" | "info";

export interface RuleResult {
  /** stable rule id, e.g. "inventory.eoi-approved" */
  id: string;
  severity: RuleSeverity;
  /** true when the rule is satisfied */
  ok: boolean;
  message: string;
  /** the entity the result is about (item id, pay item number, contract id) */
  subjectId: string;
  /** optional deep link to the thing to fix (used by closeout + radar) */
  href?: string;
}

export const blocker = (id: string, ok: boolean, message: string, subjectId: string, href?: string): RuleResult => ({
  id,
  severity: "blocker",
  ok,
  message,
  subjectId,
  href,
});
export const warning = (id: string, ok: boolean, message: string, subjectId: string, href?: string): RuleResult => ({
  id,
  severity: "warning",
  ok,
  message,
  subjectId,
  href,
});
export const info = (id: string, ok: boolean, message: string, subjectId: string, href?: string): RuleResult => ({
  id,
  severity: "info",
  ok,
  message,
  subjectId,
  href,
});
