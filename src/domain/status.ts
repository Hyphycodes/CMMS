/** Maps every status value to a pill color class. Plain colored word, no legend. */
import type {
  InventoryStatus,
  EOIApproval,
  PayItemMaterialStatus,
  GroupStatus,
} from "./types";

export type PillTone = "amber" | "blue" | "green" | "indigo" | "red" | "slate";

const INVENTORY_TONE: Record<InventoryStatus, PillTone> = {
  "Needs Attention": "amber",
  "Ready for Review": "blue",
  "Review Complete": "green",
};

const EOI_TONE: Record<EOIApproval, PillTone> = {
  Unset: "slate",
  Approved: "green",
  "Approved as Exception": "indigo",
  Rejected: "red",
};

const PAY_ITEM_TONE: Record<PayItemMaterialStatus, PillTone> = {
  Approved: "green",
  "Approved as Exception": "indigo",
  Deficient: "red",
};

const GROUP_TONE: Record<GroupStatus, PillTone> = {
  Satisfactory: "green",
  Deficient: "red",
};

export const inventoryTone = (s: InventoryStatus): PillTone => INVENTORY_TONE[s];
export const eoiTone = (s: EOIApproval): PillTone => EOI_TONE[s];
export const payItemTone = (s: PayItemMaterialStatus): PillTone => PAY_ITEM_TONE[s];
export const groupTone = (s: GroupStatus): PillTone => GROUP_TONE[s];

export const pillClass = (tone: PillTone): string => `pill pill-${tone}`;
