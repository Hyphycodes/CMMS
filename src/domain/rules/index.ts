/**
 * F3 — the rules engine entry point. `runRules(scope, …)` returns a typed list
 * of results for any scope; closeout (X1) and the radar (X2) consume the same
 * functions the store gates and the inventory UI call.
 */
import type { Contract, InventoryDetail } from "@/domain/types";
import type { RuleResult } from "./types";
import { inventoryRules } from "./inventory";
import { closeoutRules, type CloseoutContext } from "./closeout";
import { radarRules, type RadarContext } from "./radar";

export * from "./types";
export * from "./inventory";
export * from "./closeout";
export * from "./radar";
// Conversion / balance math is shared with the Quantity Book — re-exported so the
// rules layer is the single place rule logic is reached from.
export {
  conversionFactorFor,
  requiredQty,
  balanceOf,
  groupStatusOf,
  buildPayItemMaterials,
} from "@/domain/grouping";

export function runRules(scope: "inventory", subject: InventoryDetail): RuleResult[];
export function runRules(scope: "closeout", subject: Contract, ctx: CloseoutContext): RuleResult[];
export function runRules(scope: "radar", subject: null, ctx: RadarContext): RuleResult[];
export function runRules(
  scope: "inventory" | "closeout" | "radar",
  subject: InventoryDetail | Contract | null,
  ctx?: CloseoutContext | RadarContext,
): RuleResult[] {
  switch (scope) {
    case "inventory":
      return inventoryRules(subject as InventoryDetail);
    case "closeout":
      return closeoutRules(subject as Contract, ctx as CloseoutContext);
    case "radar":
      return radarRules(ctx as RadarContext);
  }
}
