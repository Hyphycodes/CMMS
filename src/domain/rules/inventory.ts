/**
 * Inventory + pay-item rules (F3). The EOI-complete gate that previously lived
 * inline in `StatusControl` (ItemDetailDrawer) is moved here verbatim so the
 * store gate and the UI agree, and so closeout can reuse it.
 */
import type { InventoryDetail, PayItemMaterialRow } from "@/domain/types";
import { type RuleResult, blocker } from "./types";

/** Number of EOI rows still awaiting a decision. */
export function unresolvedEoiCount(detail: InventoryDetail): number {
  return detail.eoi.filter((r) => r.approval === "Unset").length;
}

/**
 * Review Complete is blocked until every EOI row has been reviewed. Moved
 * verbatim from the inline check; behavior is unchanged.
 */
export function canMarkReviewComplete(detail: InventoryDetail): boolean {
  return unresolvedEoiCount(detail) === 0;
}

export function inventoryRules(detail: InventoryDetail): RuleResult[] {
  const unresolved = unresolvedEoiCount(detail);
  const results: RuleResult[] = [
    blocker(
      "inventory.eoi-approved",
      unresolved === 0,
      unresolved === 0
        ? "All Evidence of Inspection rows reviewed"
        : `${unresolved} EOI row${unresolved === 1 ? "" : "s"} still need approval before Review Complete`,
      detail.id,
    ),
  ];
  // Group/balance: a deficient pay-item material is a closeout blocker.
  for (const row of detail.payItemMaterials) {
    results.push(payItemBalanceRule(row, detail.id));
  }
  return results;
}

/** Balance/group rule for a Pay Item Materials row (shared math, F3). */
export function payItemBalanceRule(row: PayItemMaterialRow, subjectId: string): RuleResult {
  return blocker(
    "payItem.balance",
    row.balance >= 0,
    row.balance >= 0
      ? `Pay item ${row.payItemNumber}: material balance satisfactory`
      : `Pay item ${row.payItemNumber}: material deficient by ${Math.abs(row.balance)} ${row.materialUnit}`,
    subjectId,
  );
}
