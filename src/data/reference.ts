/**
 * Reference data — real example codes/producers from the manual, extended with
 * synthetic-but-plausible entries to reach scale. Generic, non-sensitive only.
 * No real people.
 */
import type { Material, MaterialFamily, Vendor } from "@/domain/types";

// MOA + Acceptable EOI by material family (Ch. 9 / 13). Materials derive these so
// inventory (brief 05) and tests (brief 04) read them off the material, not a side map.
const MOA_BY_FAMILY: Record<MaterialFamily, { moa: string; acceptableEoi: string[] }> = {
  HMA: { moa: "TEST", acceptableEoi: ["TICK", "TEST", "DPR"] },
  Paint: { moa: "QUAL", acceptableEoi: ["CERT", "LIST", "MARK"] },
  Concrete: { moa: "TEST", acceptableEoi: ["TEST", "DPR", "CERT"] },
  Aggregate: { moa: "TEST", acceptableEoi: ["TEST", "LA-15"] },
  Steel: { moa: "CERT", acceptableEoi: ["CERT", "TEST", "MARK"] },
  Soil: { moa: "VISUAL", acceptableEoi: ["TICK", "DPR"] },
  Hardware: { moa: "CERT", acceptableEoi: ["CERT", "LIST", "MARK"] },
  Other: { moa: "VISUAL", acceptableEoi: ["TICK", "CERT"] },
};

// --- Materials -------------------------------------------------------------
// The first block is verbatim from the manual (Ch. 8 / Ch. 9). The rest are
// plausible IDOT-style materials added for variety. MOA + Acceptable EOI derive
// from the material family below.
const MATERIALS_RAW: Omit<Material, "moa" | "acceptableEoi">[] = [
  // verbatim from manual
  { code: "19522R", name: "HMA BC N70 19.0", unit: "Tons", family: "HMA", conversionFactor: 0.672 },
  { code: "40458", name: "PAINT PVTMK MD EP WH", unit: "Gallons", family: "Paint", conversionFactor: 0.016 },
  { code: "40459", name: "PAINT PVTMK MD EP YL", unit: "Gallons", family: "Paint", conversionFactor: 0.016 },
  { code: "21605", name: "Concrete PC FlyAsh", unit: "CU YD", family: "Concrete", conversionFactor: 0.031 },
  { code: "21604", name: "Grout NonShrink", unit: "CU FT", family: "Concrete", conversionFactor: 0.5 },
  { code: "65501", name: "Bolt ASTM A325 Ty 1", unit: "Each", family: "Hardware", conversionFactor: 1 },
  { code: "041CA06", name: "Gravel CR CLCQ", unit: "Tons", family: "Aggregate", conversionFactor: 1.85 },
  { code: "75000", name: "Field Soil Compact", unit: "Each", family: "Soil", conversionFactor: 1 },
  { code: "6291860", name: "Reinforcement Bars Epoxy", unit: "Pounds", family: "Steel", conversionFactor: 2.67 },
  // plausible additions
  { code: "19500R", name: "HMA SC N50 9.5", unit: "Tons", family: "HMA", conversionFactor: 0.055 },
  { code: "19542R", name: "HMA BC N90 25.0", unit: "Tons", family: "HMA", conversionFactor: 0.71 },
  { code: "19320", name: "Bituminous Materials Prime Coat", unit: "Gallons", family: "HMA", conversionFactor: 0.2 },
  { code: "40460", name: "PAINT PVTMK LINE 4 WH", unit: "Gallons", family: "Paint", conversionFactor: 0.016 },
  { code: "40461", name: "Thermoplastic PVTMK WH", unit: "Pounds", family: "Paint", conversionFactor: 0.05 },
  { code: "21100", name: "PCC Pavement", unit: "CU YD", family: "Concrete", conversionFactor: 0.031 },
  { code: "21300", name: "Concrete Superstructure", unit: "CU YD", family: "Concrete", conversionFactor: 1 },
  { code: "21610", name: "Concrete Class SI", unit: "CU YD", family: "Concrete", conversionFactor: 1 },
  { code: "04157", name: "Aggregate Base Course CA-6", unit: "Tons", family: "Aggregate", conversionFactor: 1.9 },
  { code: "04158", name: "Aggregate Subgrade CS-01", unit: "Tons", family: "Aggregate", conversionFactor: 2.0 },
  { code: "6291800", name: "Reinforcement Bars Black", unit: "Pounds", family: "Steel", conversionFactor: 2.67 },
  { code: "63000", name: "Steel Plate Beam Guardrail", unit: "Foot", family: "Steel", conversionFactor: 1 },
  { code: "63100", name: "Structural Steel", unit: "Pounds", family: "Steel", conversionFactor: 1 },
  { code: "67100", name: "Sign Panel Aluminum", unit: "SQ FT", family: "Steel", conversionFactor: 1 },
  { code: "70200", name: "Traffic Barrier Terminal", unit: "Each", family: "Hardware", conversionFactor: 1 },
  { code: "75010", name: "Topsoil Furnish & Place", unit: "CU YD", family: "Soil", conversionFactor: 1 },
  { code: "78005", name: "Modified Urethane PM Line 4", unit: "Foot", family: "Paint", conversionFactor: 0.03 },
  { code: "88100", name: "Conduit in Trench 2", unit: "Foot", family: "Hardware", conversionFactor: 1 },
  { code: "60218", name: "Pipe Underdrain 6", unit: "Foot", family: "Other", conversionFactor: 1 },
  { code: "50200", name: "Concrete Box Culvert", unit: "CU YD", family: "Concrete", conversionFactor: 1 },
];

export const MATERIALS: Material[] = MATERIALS_RAW.map((m) => ({
  ...m,
  ...MOA_BY_FAMILY[m.family],
}));

// --- Vendors (producers + suppliers) --------------------------------------
// Verbatim-from-manual producers first.
export const PRODUCERS: Vendor[] = [
  { number: "2112-14", name: "Advance Asphalt Co", city: "Peoria", state: "IL" },
  { number: "3181-05", name: "SWARCO", city: "Denver", state: "CO" },
  { number: "1668-12", name: "Roanoke Concrete Products Company", city: "Spring Bay", state: "IL" },
  { number: "1266-02", name: "Meadows, W.R., Inc.", city: "Hampshire", state: "IL" },
  { number: "2010-02", name: "Unytite, Inc.", city: "Peru", state: "IL" },
  { number: "51230-09", name: "Galena Road Gravel", city: "Chillicothe", state: "IL" },
  { number: "75000-00", name: "Soil Compaction Producer None", city: "Springfield", state: "IL" },
  { number: "3454-02", name: "ABC Coating Company", city: "Joliet", state: "IL" },
  { number: "3543-14", name: "CMC Steel Tennessee", city: "Knoxville", state: "TN" },
  { number: "2394-10", name: "Nucor Steel Kankakee", city: "Bourbonnais", state: "IL" },
  { number: "6024-04", name: "Gerdau Ameristeel", city: "Knoxville", state: "TN" },
  // plausible additions
  { number: "2118-03", name: "Open Road Paving Co", city: "Bloomington", state: "IL" },
  { number: "2240-07", name: "Prairie Material Sales", city: "Bridgeview", state: "IL" },
  { number: "1702-05", name: "Central Illinois Concrete", city: "Champaign", state: "IL" },
  { number: "1845-11", name: "Vulcan Materials Company", city: "Kankakee", state: "IL" },
  { number: "1990-08", name: "Macklin Inc Quarry", city: "Macomb", state: "IL" },
  { number: "3320-06", name: "Ennis-Flint Pavement Markings", city: "Greensboro", state: "NC" },
  { number: "3702-09", name: "Sherwin-Williams Traffic Paint", city: "Cleveland", state: "OH" },
  { number: "4120-02", name: "Lehigh Hanson Aggregates", city: "Rockford", state: "IL" },
  { number: "4455-13", name: "Midwest Rebar & Steel", city: "Decatur", state: "IL" },
  { number: "5011-04", name: "Plote Construction Materials", city: "Hoffman Estates", state: "IL" },
  { number: "5260-10", name: "Curran Contracting Aggregates", city: "Crystal Lake", state: "IL" },
  { number: "5533-01", name: "Riverstone Group Inc", city: "Moline", state: "IL" },
];

export const SUPPLIERS: Vendor[] = [
  { number: "8112-01", name: "Advance Asphalt Co", city: "Peoria", state: "IL" },
  { number: "8205-04", name: "SWARCO Reflex Inc", city: "Mexico", state: "MO" },
  { number: "8330-02", name: "Contractors Supply Inc", city: "Springfield", state: "IL" },
  { number: "8451-07", name: "White Cap Construction Supply", city: "Bolingbrook", state: "IL" },
  { number: "8506-03", name: "Fastenal Industrial Supply", city: "Bloomington", state: "IL" },
  { number: "8612-09", name: "HD Supply Construction", city: "Aurora", state: "IL" },
  { number: "8744-05", name: "Ferguson Waterworks", city: "Peoria", state: "IL" },
  { number: "8890-02", name: "Midwest Steel Supply", city: "Decatur", state: "IL" },
  { number: "8911-06", name: "Roanoke Concrete Supply", city: "Spring Bay", state: "IL" },
  { number: "9020-01", name: "Galena Road Gravel Supply", city: "Chillicothe", state: "IL" },
  { number: "9134-08", name: "Prairie Material Supply", city: "Bridgeview", state: "IL" },
  { number: "9255-03", name: "Traffic Control Supply Co", city: "Rockford", state: "IL" },
];

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
