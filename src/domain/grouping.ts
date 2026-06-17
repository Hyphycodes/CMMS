/**
 * Grouping / balance math — the SINGLE source of truth shared by the inventory
 * Pay Item Materials tab (brief 05) and the Quantity Book (brief 08). They must
 * never disagree on Satisfactory/Deficient (DECISIONS D8):
 *   required = pay quantity placed × material conversion factor (custom overrides preset)
 *   balance  = provided − required
 *   group    = Satisfactory when balance ≥ 0, else Deficient
 */
import type {
  InventoryItem,
  LedgerEntry,
  PayItem,
  PayItemMaterialRow,
  GroupStatus,
} from "@/domain/types";
import { MATERIALS } from "@/data/reference";

export function conversionFactorFor(materialCode: string): number {
  return MATERIALS.find((m) => m.code === materialCode)?.conversionFactor ?? 1;
}

/** Total material received (Quantity Ledger "Received" rows), in material unit. */
export function sumReceived(ledger: LedgerEntry[]): number {
  return ledger.filter((l) => l.type === "Received").reduce((s, l) => s + l.transactionQty, 0);
}

export function requiredQty(placedQuantity: number, conversionFactor: number): number {
  return Math.round(placedQuantity * conversionFactor * 100) / 100;
}

export function balanceOf(provided: number, required: number): number {
  return Math.round((provided - required) * 100) / 100;
}

export function groupStatusOf(balance: number): GroupStatus {
  return balance >= 0 ? "Satisfactory" : "Deficient";
}

/**
 * Build the Pay Item Materials rows for an inventory item from its ledger. Used
 * by both `buildDetail` and the Quantity Book. The default Pay Item Material
 * Status mirrors the group status; a documentation override replaces it.
 */
export function buildPayItemMaterials(
  item: InventoryItem,
  payItems: PayItem[],
  ledger: LedgerEntry[],
): PayItemMaterialRow[] {
  const conversionFactor = conversionFactorFor(item.materialCode);
  const provided = sumReceived(ledger);
  const n = item.payItemNumbers.length || 1;

  return item.payItemNumbers.map((num, i) => {
    const pi = payItems.find((p) => p.number === num);
    const placed = pi?.placedQuantity ?? 0;
    const required = requiredQty(placed, conversionFactor);
    const share = item.payItemNumbers.length > 1 ? Math.round((provided / n) * 100) / 100 : provided;
    const balance = balanceOf(share, required);
    const groupStatus = groupStatusOf(balance);
    return {
      payItemNumber: num,
      payItemDescription: pi?.description ?? "—",
      payItemUnit: pi?.unit ?? "",
      placedQuantity: placed,
      group: String.fromCharCode(65 + i),
      materialQuantityProvided: share,
      materialUnit: item.materialUnit,
      conversionFactor,
      materialQuantityRequired: required,
      balance,
      groupStatus,
      payItemMaterialStatus: groupStatus === "Satisfactory" ? "Approved" : "Deficient",
    };
  });
}
