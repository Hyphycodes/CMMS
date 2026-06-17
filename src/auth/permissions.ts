/**
 * The permission matrix (brief 02). Enforced in every mutating store action AND
 * reflected in the UI (controls hide/disable with a reason). This same matrix
 * becomes the RLS policy fixture in brief 12 — keep them in lockstep.
 */
import type { Contract, Role, User } from "@/domain/types";

export type Capability =
  | "see_all_district_contracts"
  | "create_sample"
  | "enter_tests"
  | "validate_test"
  | "approve_sample"
  | "create_inventory"
  | "upload_eoi"
  | "assign_pay_items"
  | "set_inventory_ready"
  | "approve_eoi"
  | "set_pay_item_material_status"
  | "bulk_mark_review_complete"
  | "author_contract" // diary, quantity book, placements
  | "submit_pay_estimate"
  | "manage_authorization"
  | "manage_users";

/** capability → roles allowed (the brief-02 matrix, verbatim). */
const MATRIX: Record<Capability, Role[]> = {
  see_all_district_contracts: ["Documentation", "DistrictAdmin"],
  create_sample: ["Inspector", "ResidentEngineer", "DistrictAdmin"],
  enter_tests: ["Inspector", "DistrictAdmin"],
  validate_test: ["Inspector", "DistrictAdmin"],
  approve_sample: ["Inspector", "Documentation", "DistrictAdmin"],
  create_inventory: ["Inspector", "ResidentEngineer", "DistrictAdmin"],
  upload_eoi: ["Inspector", "ResidentEngineer", "DistrictAdmin"],
  assign_pay_items: ["ResidentEngineer", "DistrictAdmin"],
  set_inventory_ready: ["Inspector", "ResidentEngineer", "Documentation", "DistrictAdmin"],
  approve_eoi: ["Documentation", "DistrictAdmin"],
  set_pay_item_material_status: ["Documentation", "DistrictAdmin"],
  bulk_mark_review_complete: ["Documentation", "DistrictAdmin"],
  author_contract: ["ResidentEngineer", "DistrictAdmin"],
  submit_pay_estimate: ["ResidentEngineer", "DistrictAdmin"],
  manage_authorization: ["ResidentEngineer", "DistrictAdmin"],
  manage_users: ["DistrictAdmin"],
};

export function can(user: User | undefined, cap: Capability): boolean {
  if (!user) return false;
  const allowed = MATRIX[cap];
  return user.roles.some((r) => allowed.includes(r));
}

/** Human-friendly reason for a disabled control (keeps disabled legible). */
export function whyDenied(cap: Capability): string {
  const allowed = MATRIX[cap].map(roleLabel).join(", ");
  return `Requires role: ${allowed}.`;
}

export const ROLE_LABELS: Record<Role, string> = {
  Inspector: "Inspector",
  ResidentEngineer: "Resident Engineer",
  Contractor: "Contractor",
  Documentation: "Documentation / Materials Reviewer",
  DistrictAdmin: "District Admin",
};

export function roleLabel(r: Role): string {
  return ROLE_LABELS[r];
}

/**
 * Effective visible contracts = union(contracts in districtIds, explicit
 * contractIds). Documentation/Admin typically carry whole districts; Inspector /
 * RE / Contractor carry explicit contracts.
 */
export function visibleContractIds(user: User | undefined, contracts: Contract[]): Set<string> {
  const out = new Set<string>();
  if (!user) return out;
  const districts = new Set(user.districtIds);
  const explicit = new Set(user.contractIds);
  for (const c of contracts) {
    if (districts.has(c.district) || explicit.has(c.id)) out.add(c.id);
  }
  return out;
}

/** The home a user lands on (brief 02 role-aware landing). */
export type Landing = "inbox" | "my-day" | "my-contracts" | "contractor";

export function landingFor(user: User | undefined): Landing {
  if (!user) return "inbox";
  if (user.roles.includes("Documentation") || user.roles.includes("DistrictAdmin")) return "inbox";
  if (user.roles.includes("ResidentEngineer")) return "my-contracts";
  if (user.roles.includes("Inspector")) return "my-day";
  if (user.roles.includes("Contractor")) return "contractor";
  return "inbox";
}
