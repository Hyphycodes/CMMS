/**
 * Reference data — the REAL IDOT master lists (brief 14), imported as JSON, not
 * hand-typed:
 *   materials.json — 1,481 codes from CMMS Part 3, Manual for Materials Inspection (3/13/2026)
 *   vendors.json   — 14,382 producer/supplier records from the MISTIC master (5/22/26)
 * Provenance kept verbatim; these are the real agency codes/terms now.
 */
import type { Material, MaterialFamily, Vendor } from "@/domain/types";
import materialsData from "./reference/materials.json";
import vendorsData from "./reference/vendors.json";

/**
 * Per-family conversion-factor preset (DECISIONS D8). The PDFs do NOT publish a
 * per-code material conversion factor, so we default by family and flag exact
 * per-code factors for review (see CONVERSION_FACTOR_TODO). Don't fabricate
 * per-code factors. Representative values are the manual's published examples.
 */
export const CONVERSION_FACTOR_BY_FAMILY: Record<MaterialFamily, number> = {
  HMA: 0.672,
  Paint: 0.016,
  Concrete: 0.031,
  Aggregate: 1.9,
  Steel: 2.67,
  Soil: 1,
  Hardware: 1,
  Other: 1,
};

// Cast-free narrowing of the JSON's `family` string → MaterialFamily (dirty/unknown
// values fall to "Other"), so no `as` is needed at the import boundary.
const FAMILY_BY_NAME: Record<string, MaterialFamily> = {
  HMA: "HMA",
  Paint: "Paint",
  Concrete: "Concrete",
  Aggregate: "Aggregate",
  Steel: "Steel",
  Soil: "Soil",
  Hardware: "Hardware",
  Other: "Other",
};

// --- Materials -------------------------------------------------------------
// Real CMMS Part 3 codes. moa + acceptableEoi come from the data; conversionFactor
// is resolved by family (see above) since the source omits it.
// The FULL 1,481-code master is surfaced everywhere — material pickers (Add
// Sample, Create Inventory), the Material Definition list, code lookups, and the
// seed all draw from it. (The user's real samples come from my_samples.json and
// are independent of this list.)
export const ALL_MATERIALS: Material[] = materialsData.map((m): Material => {
  const family = FAMILY_BY_NAME[m.family] ?? "Other";
  return {
    code: m.code,
    name: m.name,
    unit: m.unit,
    family,
    conversionFactor: CONVERSION_FACTOR_BY_FAMILY[family],
    moa: m.moa,
    acceptableEoi: m.acceptableEoi,
    group: m.group || undefined,
    specialId: m.specialId || undefined,
    sampleSize: m.sampleSize || undefined,
    materialOwner: m.materialOwner || undefined,
    babaDsa: m.babaDsa || undefined,
    remark: m.remark || undefined,
    specifications: m.specifications || undefined,
  };
});

/**
 * MATERIALS is the full CMMS master — the complete 1,481-code database. Every
 * material picker, the Material Definition list, and the seed draw from it.
 */
export const MATERIALS: Material[] = ALL_MATERIALS;

/**
 * Per-code conversion factors are defaulted by family — every code is a candidate
 * for a real factor before grouping math (brief 05/08) is trusted in production.
 * Materials whose family default is the neutral 1.0 most need a real value.
 */
export const CONVERSION_FACTOR_TODO: string[] = MATERIALS.filter(
  (m) => CONVERSION_FACTOR_BY_FAMILY[m.family] === 1,
).map((m) => m.code);

// --- Vendors (producers + suppliers) --------------------------------------
// The MISTIC master is one combined list; a vendor serves as producer OR supplier,
// exactly like the prior seed design. Default pools are the active records.
export const VENDORS: Vendor[] = vendorsData;
const ACTIVE_VENDORS: Vendor[] = VENDORS.filter((v) => v.active !== false);
export const PRODUCERS: Vendor[] = ACTIVE_VENDORS;
export const SUPPLIERS: Vendor[] = ACTIVE_VENDORS;

// --- Evidence of Inspection / Method of Acceptance codes (Ch. 8) -----------
export const EOI_CODES = ["TICK", "TEST", "DPR", "LA-15", "LIST", "CERT", "MARK"] as const;
export const MOA_CODES = ["TEST", "QUAL", "CERT", "VISUAL"] as const;

// --- Sample reference (Ch. 9) ----------------------------------------------
export const INSPECTION_TYPES = ["ACC", "PRO", "IND", "QA"] as const;
export const SAMPLED_FROM = [
  "Jobsite",
  "Manufacturer's Plant",
  "Stockpile",
  "Truck",
  "Plant",
] as const;
export const RESPONSIBLE_LABS = [
  "District Lab",
  "Central BMPR Lab",
  "Independent Assurance",
  "Producer QC Lab",
] as const;

// --- Contract reference ----------------------------------------------------
export const WORK_TYPES = [
  "HMA Resurfacing",
  "PCC Pavement",
  "Pavement Marking",
  "Bridge Deck Repair",
  "Bridge Rehabilitation",
  "Sign Structures",
  "Patching",
  "Cold Milling & Resurfacing",
  "Aggregate Base Course",
  "Drainage & Storm Sewer",
  "Guardrail & Safety",
  "Roadway Lighting",
  "Earthwork & Grading",
  "Intersection Improvement",
];

export const IL_COUNTIES = [
  "Adams", "Champaign", "Cook", "DuPage", "Kane", "Kankakee", "Knox", "LaSalle",
  "Macon", "Madison", "McLean", "Peoria", "Rock Island", "Sangamon", "St. Clair",
  "Tazewell", "Vermilion", "Will", "Winnebago", "Woodford",
];

// Synthetic prime contractor names (no real people).
export const CONTRACTORS = [
  "Illinois Valley Paving Co",
  "Prairie State Construction LLC",
  "Central Asphalt & Materials",
  "Midwest Road Builders Inc",
  "Cornbelt Civil Contractors",
  "Heartland Grading & Excavating",
  "Riverbend Bridge Company",
  "Statewide Pavement Marking Inc",
  "Great Plains Infrastructure",
  "Lincoln Highway Constructors",
];

export const DESIGNER_FIRMS = [
  "Hanson Professional Services",
  "Crawford Murphy & Tilly",
  "Hutchison Engineering",
  "Patrick Engineering",
  "Clark Dietz Inc",
];

// Synthetic staff names for Resident Engineer / reviewers (no real people).
export const STAFF_NAMES = [
  "A. Calloway", "B. Reynolds", "C. Okafor", "D. Schwartz", "E. Marquez",
  "F. Nakamura", "G. Patel", "H. Lindqvist", "J. Boone", "K. Ferraro",
  "L. Whitfield", "M. Delgado", "N. Abernathy", "P. Sorensen", "R. Castellano",
];
