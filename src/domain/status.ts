/** Maps every status value to a pill color class. Plain colored word, no legend. */
import type {
  InventoryStatus,
  EOIApproval,
  PayItemMaterialStatus,
  GroupStatus,
  SampleStatus,
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

const SAMPLE_TONE: Record<SampleStatus, PillTone> = {
  "Logged In": "slate",
  "In Testing": "amber",
  Tested: "blue",
  Validated: "indigo",
  Approved: "green",
  Rejected: "red",
};

export const inventoryTone = (s: InventoryStatus | null): PillTone => (s ? INVENTORY_TONE[s] : "slate");
export const eoiTone = (s: EOIApproval): PillTone => EOI_TONE[s];
export const payItemTone = (s: PayItemMaterialStatus): PillTone => PAY_ITEM_TONE[s];
export const groupTone = (s: GroupStatus): PillTone => GROUP_TONE[s];
export const sampleTone = (s: SampleStatus): PillTone => SAMPLE_TONE[s];

export const pillClass = (tone: PillTone): string => `pill pill-${tone}`;

/**
 * Brief 22 — a Test ID / test record is editable while the sample is in a
 * testing state, and frozen once it's been Approved (or Rejected). The single
 * helper EOI and the Sample drawer both drive their lock off.
 */
export function isTestEditable(status: SampleStatus): boolean {
  return status !== "Approved" && status !== "Rejected";
}
