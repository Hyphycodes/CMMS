/**
 * Deterministic world generator. Produces ~200 contracts and ~8,000 inventory
 * items (with ~1,200 in "Ready for Review" of varying ages, plus intentional
 * duplicates) from a fixed master seed, so every load/re-run is identical.
 *
 * Top-level inventory rows are generated eagerly; per-item detail (ledger / EOI
 * / pay-item-materials) is built on demand by `buildDetail` to keep load fast.
 */
import {
  MATERIALS,
  PRODUCERS,
  SUPPLIERS,
  CONTRACTORS,
  DESIGNER_FIRMS,
  STAFF_NAMES,
  WORK_TYPES,
  IL_COUNTIES,
  EOI_CODES,
  MOA_CODES,
} from "@/data/reference";
import type {
  Contract,
  ContractSummary,
  InventoryItem,
  InventoryDetail,
  PayItem,
  LedgerEntry,
  LedgerType,
  EOIEntry,
  EOIApproval,
  PayItemMaterialStatus,
  Material,
  MaterialFamily,
  Vendor,
  Sample,
  SampleStatus,
  Test,
  TestTemplate,
  DiaryDay,
  DiarySuspension,
  PlacementEntry,
  PayEstimate,
  PayEstimateLine,
  Authorization,
  AuthType,
  AuthApproval,
  MixDesign,
} from "@/domain/types";
import { makeRng, type Rng } from "./rng";
import { buildPayItemMaterials } from "@/domain/grouping";
import { lineAmount, sumAmounts } from "@/domain/money";
import myProjects from "@/data/reference/my_projects.json";
import mySamples from "@/data/reference/my_samples.json";
import { CONTRACT_61D34, PAY_ITEMS_61D34, INVENTORY_61D34 } from "./contract61D34";

export const MASTER_SEED = "proof-cmms-v1";
const MS_DAY = 86_400_000;

/** Stable contract id for a real project, keyed by its number. */
export const realContractId = (number: string): string => `ct_real_${number}`;

/** Parse a legacy "M/D/YYYY" (or already-ISO) date into ISO "YYYY-MM-DD". */
function parseLegacyDate(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yyyy}-${mm}-${dd}`;
}

export interface SeedConfig {
  contracts: number;
  inventoryItems: number;
  readyForReviewCount: number;
}

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  contracts: 200,
  inventoryItems: 8000,
  readyForReviewCount: 1200,
};

export interface World {
  contracts: Contract[];
  items: InventoryItem[];
  payItemsByContract: Map<string, PayItem[]>;
  samples: Sample[];
  tests: Test[];
  testTemplates: TestTemplate[];
  suspensionsByContract: Map<string, DiarySuspension[]>;
  placements: PlacementEntry[];
  payEstimates: PayEstimate[];
  authorizations: Authorization[];
  mixDesigns: MixDesign[];
}

/** Mix designs for HMA/PCC families (Ch. 9) — brief 11. */
function generateMixDesigns(): MixDesign[] {
  const rng = makeRng(`${MASTER_SEED}:mixdesign`);
  const families = MATERIALS.filter((m) => m.family === "HMA" || m.family === "Concrete");
  const out: MixDesign[] = [];
  for (const m of families) {
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const producer = producerFor(m, rng);
      out.push({
        number: m.family === "HMA" ? `80BIT${rng.int(1000, 9999)}` : `PCC${rng.int(1000, 9999)}`,
        materialCode: m.code,
        family: m.family,
        producer: producer.name,
        approved: rng.bool(0.8),
      });
    }
  }
  return out;
}

export const AUTH_STEPS: Record<AuthType, string[]> = {
  Standard: ["Resident Engineer", "District Construction"],
  "Overage/Balancing": ["Resident Engineer", "District Construction", "Bureau of Construction"],
  "Major Change": ["Resident Engineer", "District Construction", "Bureau of Construction", "FHWA"],
};

const FUND_KEYS = ["FED-STP", "STATE-01", "LOCAL-A", "FED-NHPP", "STATE-BR"];

// Test field templates keyed by material family (Ch. 11) — drives the Tests tab.
export const TEST_TEMPLATES: TestTemplate[] = [
  {
    materialFamily: "HMA",
    testType: "Marshall / Gradation",
    fields: [
      { key: "ac", label: "Asphalt Content %" },
      { key: "va", label: "Voids (Va) %" },
      { key: "vma", label: "VMA %" },
      { key: "gmm", label: "Gmm" },
      { key: "passing200", label: "% Passing #200" },
    ],
  },
  {
    materialFamily: "Concrete",
    testType: "Compressive Strength",
    fields: [
      { key: "slump", label: "Slump (in)" },
      { key: "air", label: "Air %" },
      { key: "strength7", label: "7-day (psi)" },
      { key: "strength28", label: "28-day (psi)" },
    ],
  },
  {
    materialFamily: "Steel",
    testType: "Tensile / Bend",
    fields: [
      { key: "yield", label: "Yield (ksi)" },
      { key: "tensile", label: "Tensile (ksi)" },
      { key: "elong", label: "Elongation %" },
      { key: "bend", label: "Bend Test" },
    ],
  },
  {
    materialFamily: "Aggregate",
    testType: "Gradation",
    fields: [
      { key: "passing4", label: "% Passing #4" },
      { key: "passing200", label: "% Passing #200" },
      { key: "ld", label: "L.A. Abrasion %" },
    ],
  },
  {
    materialFamily: "Soil",
    testType: "Proctor / Density",
    fields: [
      { key: "maxdry", label: "Max Dry Density (pcf)" },
      { key: "optmoist", label: "Optimum Moisture %" },
      { key: "fielddensity", label: "Field Density %" },
    ],
  },
  {
    materialFamily: "Paint",
    testType: "Film / Retroreflectivity",
    fields: [
      { key: "thickness", label: "Wet Film (mil)" },
      { key: "retro", label: "Retroreflectivity (mcd)" },
      { key: "dry", label: "Dry Time (min)" },
    ],
  },
];


// Pay item templates — real IDOT-style codes from the manual + plausible ones.
const PAY_ITEM_TEMPLATES = [
  { code: "44201794", description: "CLASS D PATCHES, TYPE III, 12 INCH", unit: "SQ YD", family: "HMA" },
  { code: "40600300", description: "HOT-MIX ASPHALT SURFACE COURSE, MIX D, N70", unit: "TON", family: "HMA" },
  { code: "40600100", description: "HOT-MIX ASPHALT BINDER COURSE, IL-19.0, N70", unit: "TON", family: "HMA" },
  { code: "78009004", description: "MODIFIED URETHANE PAVT MARKING - LINE 4", unit: "FOOT", family: "Paint" },
  { code: "78000650", description: "THERMOPLASTIC PAVT MARKING - LINE 4", unit: "FOOT", family: "Paint" },
  { code: "50300225", description: "CONCRETE STRUCTURES", unit: "CU YD", family: "Concrete" },
  { code: "42400800", description: "PORTLAND CEMENT CONCRETE PAVEMENT, 10 INCH", unit: "SQ YD", family: "Concrete" },
  { code: "50800205", description: "REINFORCEMENT BARS, EPOXY COATED", unit: "POUND", family: "Steel" },
  { code: "63000100", description: "STEEL PLATE BEAM GUARDRAIL, TYPE A", unit: "FOOT", family: "Steel" },
  { code: "20200100", description: "AGGREGATE BASE COURSE, TYPE B 8 INCH", unit: "SQ YD", family: "Aggregate" },
  { code: "67100100", description: "SIGN PANEL - TYPE 1", unit: "SQ FT", family: "Steel" },
  { code: "60218100", description: "PIPE UNDERDRAINS, TYPE 1, 6 INCH", unit: "FOOT", family: "Other" },
  { code: "21001000", description: "GEOTECHNICAL FABRIC FOR GROUND STABILIZATION", unit: "SQ YD", family: "Soil" },
] as const;

// Real MISTIC category code → MaterialFamily (brief 14). Unmapped categories
// (incl. numeric ones like "175"/"215") fall to Other — producerFor still works
// via the all-producers fallback, so coherence holds without guessing.
const CATEGORY_TO_FAMILY: Record<string, MaterialFamily> = {
  ASPHLT: "HMA",
  AGGRAV: "Aggregate", AGCONC: "Aggregate", AGDOLO: "Aggregate", AGLIME: "Aggregate",
  AGGUKN: "Aggregate", AGSAND: "Aggregate", AGSTON: "Aggregate", AGSLAG: "Aggregate",
  CEMENT: "Concrete", CONC: "Concrete", AGCEM: "Concrete", MASNRY: "Concrete",
  REBARS: "Steel", MTPROD: "Steel", "L&SSTD": "Steel", CABLES: "Steel", STEEL: "Steel",
  PAINT: "Paint",
  LANDSC: "Soil", GEOTEX: "Soil",
  FASTEN: "Hardware",
};

// Real producers grouped by inferred family for coherent seeding. Built once from
// the live vendor pool; producerFor falls back to all producers for empty families.
const PRODUCERS_BY_FAMILY: Record<MaterialFamily, Vendor[]> = (() => {
  const map: Record<MaterialFamily, Vendor[]> = {
    HMA: [], Paint: [], Concrete: [], Aggregate: [], Steel: [], Soil: [], Hardware: [], Other: [],
  };
  for (const v of PRODUCERS) {
    const fam = (v.category && CATEGORY_TO_FAMILY[v.category]) || "Other";
    map[fam].push(v);
  }
  return map;
})();

function producerFor(material: Material, rng: Rng): Vendor {
  const pool = PRODUCERS_BY_FAMILY[material.family];
  return pool.length ? rng.pick(pool) : rng.pick(PRODUCERS);
}

function money(rng: Rng, min: number, max: number): number {
  return Math.round(rng.float(min, max) / 100) * 100;
}

function isoDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function generateContract(index: number, rng: Rng): Contract {
  const district = rng.int(1, 9);
  const county = rng.pick(IL_COUNTIES);
  const workType = rng.pick(WORK_TYPES);
  const number = `${60 + district}${String(rng.int(100, 999))}`;
  const route = rng.pick(["FAI 74", "FAP 685", "US 51", "IL 9", "IL 116", "FAU 6265", "US 24", "IL 29"]);
  const section = `(${rng.int(1, 40)}${rng.pick(["A", "B", "RS", "BR", "N", ""])}) ${rng.pick(["RS-1", "BR-2", "P-1", "I-3", "M-1"])}`;
  const contractor = rng.pick(CONTRACTORS);

  const now = Date.now();
  const lettingDate = now - rng.int(200, 900) * MS_DAY;
  const awardDate = lettingDate + rng.int(14, 45) * MS_DAY;
  const executedDate = awardDate + rng.int(14, 60) * MS_DAY;
  const ntpDate = executedDate + rng.int(7, 30) * MS_DAY;
  const completionDate = ntpDate + rng.int(120, 540) * MS_DAY;
  const contractStatus = rng.weighted<string>([
    ["Active", 6],
    ["Suspended", 1],
    ["Completed", 2],
    ["Closed", 1],
  ]);

  const awarded = money(rng, 480_000, 14_500_000);
  const current = Math.round(awarded * rng.float(1.0, 1.08));
  const paid = Math.round(current * rng.float(0.2, 0.95));

  const summary: ContractSummary = {
    jobDescription: `${workType} on ${route}, ${county} County`,
    section,
    route,
    county,
    district,
    projectNumber: `${rng.pick(["ACNHF", "STP", "NHPP", "HSIP"])}-${String(rng.int(1000, 9999))}(${rng.int(100, 999)})`,
    federalProjectNumber: rng.bool(0.6) ? `${String(rng.int(1000, 9999))}(${rng.int(1, 99)})` : "",
    contractStatus,
    primeContractor: contractor,
    primeContractorId: `C-${rng.int(10000, 99999)}`,
    residentEngineer: rng.pick(STAFF_NAMES),
    supervisingFieldEngineer: rng.pick(STAFF_NAMES),
    districtConstructionEngineer: rng.pick(STAFF_NAMES),
    designerFirm: rng.pick(DESIGNER_FIRMS),
    projectImplementationEngineer: rng.pick(STAFF_NAMES),
    progressScheduleReceived: rng.bool(0.7) ? isoDate(ntpDate + rng.int(1, 20) * MS_DAY) : null,
    ehsPlanReceived: rng.bool(0.5) ? isoDate(ntpDate + rng.int(1, 25) * MS_DAY) : null,
    dbeProgramReceived: rng.bool(0.6) ? isoDate(awardDate + rng.int(1, 30) * MS_DAY) : null,
    lettingDate: isoDate(lettingDate),
    awardDate: isoDate(awardDate),
    executedDate: isoDate(executedDate),
    noticeToProceedDate: isoDate(ntpDate),
    workBeginDate: isoDate(ntpDate + rng.int(1, 20) * MS_DAY),
    contractCompletionDate: isoDate(completionDate),
    finalInspectionDate: contractStatus === "Completed" || contractStatus === "Closed"
      ? isoDate(completionDate + rng.int(1, 40) * MS_DAY)
      : null,
    contractSuspendedDate: contractStatus === "Suspended" ? isoDate(now - rng.int(5, 60) * MS_DAY) : null,
    engineersEstimate: Math.round(awarded * rng.float(0.9, 1.12)),
    awardedAmount: awarded,
    currentContractAmount: current,
    totalPaidToDate: paid,
    dbeGoalPct: rng.pick([0, 4, 5, 6, 8, 10, 12]),
    dbeCommittedPct: rng.pick([0, 5, 6, 8, 11, 13]),
    adjustmentAmount: current - awarded,
    primaryWorkType: workType,
    terrain: rng.pick(["Level", "Rolling", "Urban", "Mountainous"]),
    funding: rng.weighted<string>([["Federal", 5], ["State", 4], ["Local", 1]]),
    specificationYear: rng.pick(["2016", "2022"]),
    units: "English",
    timeType: rng.weighted<string>([["Working Days", 4], ["Calendar Days", 4], ["Completion Date", 2]]),
    originalContractTime: rng.int(45, 400),
    currentContractTime: 0, // filled below
    timeChargedToDate: 0,
    liquidatedDamagesPerDay: rng.pick([500, 750, 1000, 1500, 2200, 3000]),
  };
  summary.currentContractTime = summary.originalContractTime + rng.int(0, 30);
  summary.timeChargedToDate = Math.min(
    summary.currentContractTime,
    Math.round(summary.currentContractTime * rng.float(0.1, 0.95)),
  );

  const closing = contractStatus === "Completed" || contractStatus === "Closed";
  const fut = () => isoDate(now + rng.int(60, 540) * MS_DAY);
  const past = () => isoDate(now - rng.int(10, 200) * MS_DAY);
  const maybePast = (p = 0.6) => (rng.bool(p) ? past() : null);
  const closeDate = (p = 0.8) => (closing && rng.bool(p) ? past() : null);

  const insurance = {
    contractorNo: summary.primeContractorId,
    primeContractorName: contractor,
    itemNo: String(rng.int(1, 6)),
    finalAcceptanceDate: closeDate(0.9),
    pctComplete: summary.currentContractAmount
      ? Math.round((summary.totalPaidToDate / summary.currentContractAmount) * 100)
      : 0,
    pctCompleteDate: past(),
    policies: (
      ["General Liability", "Automotive Liability", "Umbrella Liability", "Workman's Compensation"] as const
    ).map((kind) => ({
      kind,
      status: rng.weighted<string>([["Blanket Certification", 5], ["On File", 3], ["Expired", 1]]),
      expiration: fut(),
    })),
    railroad: rng.bool(0.15)
      ? [
          {
            policyNo: `RR-${rng.int(10000, 99999)}`,
            company: rng.pick(["BNSF", "Union Pacific", "CN", "Norfolk Southern"]),
            expiration: fut(),
            approvalRequested: maybePast(),
            approvalReceipt: maybePast(0.4),
            workCompleted: closeDate(0.5),
          },
        ]
      : [],
  };

  const subcontractors = Array.from({ length: rng.int(0, 5) }, () => ({
    createDate: isoDate(awardDate + rng.int(10, 120) * MS_DAY),
    companyNumber: `C-${rng.int(10000, 99999)}`,
    name: rng.pick([...CONTRACTORS, ...DESIGNER_FIRMS]),
  }));

  const DOC_TITLES = [
    "Preconstruction Meeting Minutes",
    "Submittal — Mix Design",
    "RFI Response",
    "Change Order Backup",
    "Progress Schedule Update",
    "Environmental Compliance Letter",
    "Material Certification Packet",
    "Weekly Payroll Certification",
  ];
  const DOC_SUBJECTS = ["Meeting", "Submittal", "RFI", "Correspondence", "Schedule", "Compliance", "Certification", "Payroll"];
  const projectDocuments = Array.from({ length: rng.int(0, 6) }, (_, i) => {
    const t = rng.int(0, DOC_TITLES.length - 1);
    return {
      id: `doc_${index}_${i}`,
      date: isoDate(executedDate + rng.int(1, 300) * MS_DAY),
      title: DOC_TITLES[t],
      subject: DOC_SUBJECTS[t],
      from: rng.pick(STAFF_NAMES),
      attachment: `${DOC_TITLES[t].replace(/\s+/g, "_")}.pdf`,
      origin: rng.weighted<string>([["IDOT", 6], ["Contractor", 3], ["Consultant", 1]]),
      hasFile: rng.bool(0.8),
    };
  });

  const finalReview = {
    finalFromDistrict: {
      deadlineForFinalFrcBills: closeDate(),
      finalInspectionLetters: closeDate(),
      allPayItemsFinal: closing && rng.bool(0.7),
      fqSent: closeDate(),
      fqAgree: closeDate(0.6),
      fqCertified: closeDate(0.5),
      fqReceived: closeDate(0.5),
      challengedFq: rng.bool(0.1),
      intentToFileClaim: rng.bool(0.08),
      claimL1: rng.bool(0.06) ? past() : null,
      claimL2: null,
      claimResolved: null,
      qtyAdjustmentLetter: closeDate(0.4),
      opsSignoff: closeDate(0.5),
      finalInspectionBc71: closeDate(0.6),
      fpeBc111: closeDate(0.4),
      localAgencyCertBc608: closeDate(0.3),
      recordsPayrollRetention: closeDate(0.4),
      recordsLocation: closing ? rng.pick(["District 4 Records", "Central Files", "Field Office"]) : "",
      stateCompletionNotice: closeDate(0.5),
      forCoToReview: closing && rng.bool(0.3),
      projectControlManager: rng.pick(STAFF_NAMES),
    },
    documentationReview: {
      recordsTurnedIn: closeDate(0.7),
      auditStart: closeDate(0.6),
      numIssues: closing ? rng.int(0, 12) : 0,
      auditGivenToResident: closeDate(0.5),
      correctionsDue: closeDate(0.4),
      correctionsSubmitted: closeDate(0.4),
      auditFinalized: closeDate(0.3),
      reviewer: closing ? rng.pick(STAFF_NAMES) : "",
      progressReview: closing ? rng.pick(["On Track", "Behind", "Complete"]) : "",
      remarks: "",
    },
    materialsReview: {
      numIssues: closing ? rng.int(0, 8) : 0,
      exceptions: closing ? rng.int(0, 4) : 0,
      reviewStart: closeDate(0.6),
      auditGiven: closeDate(0.5),
      correctionsDue: closeDate(0.4),
      pccSignoffSent: closeDate(0.5),
      pccSignoffRcvd: closeDate(0.4),
      hmaSignoffSent: closeDate(0.5),
      hmaSignoffRcvd: closeDate(0.4),
      soilsSignoffSent: closeDate(0.4),
      soilsSignoffRcvd: closeDate(0.3),
      materialsCertDate: closeDate(0.4),
      exceptionLetterDate: rng.bool(0.1) ? past() : null,
      reviewer: closing ? rng.pick(STAFF_NAMES) : "",
      remarks: "",
    },
    performancePeriod: rng.bool(0.4)
      ? [
          {
            type: rng.pick(["HMA", "PCC", "Pavement Marking", "Seeding"]),
            required: `${rng.int(1, 3)} year`,
            yearPlaced: String(2020 + rng.int(0, 5)),
            inspectionNeeded: rng.bool(0.5),
            repairsNeeded: rng.bool(0.3),
            letterSent: maybePast(0.4),
            repairsMade: rng.bool(0.3),
            bond: rng.pick(["Maintenance Bond", "Warranty Bond", "—"]),
            approvedLetterSent: maybePast(0.3),
          },
        ]
      : [],
    dbeCloseOut: {
      commitmentPct: summary.dbeCommittedPct,
      bc2115: closing && rng.bool(0.6),
      allSbe2115: closing && rng.bool(0.5),
      approved: closing && rng.bool(0.5),
      goalMet: rng.bool(0.7),
      dbeFinalDocSbe2028: closing && rng.bool(0.5),
      waiverRequested: rng.bool(0.1),
      waiverGranted: rng.bool(0.05),
      packet2028Approved: closing && rng.bool(0.4),
      eeoRemarks: "",
      eeoRepresentative: rng.pick(STAFF_NAMES),
    },
  };

  return {
    id: `ct_${index}`,
    number,
    name: `${county} County — ${workType}`,
    county,
    district,
    workType,
    inventoryCount: 0,
    readyForReviewCount: 0,
    summary,
    insurance,
    subcontractors,
    projectDocuments,
    finalReview,
  };
}

function generatePayItems(_contract: Contract, rng: Rng): PayItem[] {
  const n = rng.int(5, 12);
  const templates = rng.sample(PAY_ITEM_TEMPLATES, Math.min(n, PAY_ITEM_TEMPLATES.length));
  return templates.map((t) => {
    const awarded = rng.float(200, 12000, 0);
    return {
      number: t.code,
      description: t.description,
      unit: t.unit,
      unitPrice: rng.float(2, 850),
      awardedQuantity: awarded,
      placedQuantity: Math.round(awarded * rng.float(0.15, 1.0)),
      fundKey: rng.pick(FUND_KEYS),
      final: false,
    };
  });
}

function generatePlacements(contracts: Contract[], payItemsByContract: Map<string, PayItem[]>): PlacementEntry[] {
  const out: PlacementEntry[] = [];
  let seq = 1;
  for (const c of contracts) {
    const rng = makeRng(`${MASTER_SEED}:placements:${c.id}`);
    for (const pi of payItemsByContract.get(c.id) ?? []) {
      const n = rng.int(1, 4);
      let remaining = pi.placedQuantity;
      for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        const qty = last ? remaining : Math.round((remaining / (n - i)) * rng.float(0.5, 1.3));
        remaining = Math.max(0, remaining - qty);
        out.push({
          id: `plc_${seq++}`,
          payItemNumber: pi.number,
          contractId: c.id,
          date: isoDate(Date.now() - rng.int(10, 300) * MS_DAY),
          fundKey: pi.fundKey ?? rng.pick(FUND_KEYS),
          type: rng.weighted<PlacementEntry["type"]>([["Placed", 8], ["Adjustment", 2]]),
          quantity: qty,
          price: pi.unitPrice,
          location: rng.pick(["Sta 10+00", "Sta 24+50", "NB Lane", "SB Lane", "Ramp A", "Bridge Deck"]),
          contractor: c.summary.primeContractor,
          posted: rng.bool(0.6),
          payEstimateId: null,
          creator: rng.pick(STAFF_NAMES),
        });
      }
    }
  }
  return out;
}

/** Build the full world deterministically. */
/**
 * A real project (my_projects.json) as a minimal Contract — records exist so
 * samples can link to them; names/summary details are intentionally empty for
 * the user to fill later. All required nested objects are empty/zeroed.
 */
function makeRealContract(p: { number: string; name: string; workType: string }): Contract {
  const emptySummary: ContractSummary = {
    jobDescription: "", section: "", route: "", county: "", district: 0,
    projectNumber: "", federalProjectNumber: "", contractStatus: "Active",
    primeContractor: "", primeContractorId: "", residentEngineer: "",
    supervisingFieldEngineer: "", districtConstructionEngineer: "", designerFirm: "",
    projectImplementationEngineer: "", progressScheduleReceived: null, ehsPlanReceived: null,
    dbeProgramReceived: null, lettingDate: null, awardDate: null, executedDate: null,
    noticeToProceedDate: null, workBeginDate: null, contractCompletionDate: null,
    finalInspectionDate: null, contractSuspendedDate: null, engineersEstimate: 0,
    awardedAmount: 0, currentContractAmount: 0, totalPaidToDate: 0, dbeGoalPct: 0,
    dbeCommittedPct: 0, adjustmentAmount: 0, primaryWorkType: p.workType, terrain: "",
    funding: "", specificationYear: "", units: "English", timeType: "", originalContractTime: 0,
    currentContractTime: 0, timeChargedToDate: 0, liquidatedDamagesPerDay: 0,
  };
  return {
    id: realContractId(p.number),
    number: p.number,
    name: p.name || p.number,
    county: "",
    district: 0,
    workType: p.workType,
    inventoryCount: 0,
    readyForReviewCount: 0,
    summary: emptySummary,
    insurance: {
      contractorNo: "", primeContractorName: "", itemNo: "", finalAcceptanceDate: null,
      pctComplete: 0, pctCompleteDate: null, policies: [], railroad: [],
    },
    subcontractors: [],
    projectDocuments: [],
    finalReview: {
      finalFromDistrict: {
        deadlineForFinalFrcBills: null, finalInspectionLetters: null, allPayItemsFinal: false,
        fqSent: null, fqAgree: null, fqCertified: null, fqReceived: null, challengedFq: false,
        intentToFileClaim: false, claimL1: null, claimL2: null, claimResolved: null,
        qtyAdjustmentLetter: null, opsSignoff: null, finalInspectionBc71: null, fpeBc111: null,
        localAgencyCertBc608: null, recordsPayrollRetention: null, recordsLocation: "",
        stateCompletionNotice: null, forCoToReview: false, projectControlManager: "",
      },
      documentationReview: {
        recordsTurnedIn: null, auditStart: null, numIssues: 0, auditGivenToResident: null,
        correctionsDue: null, correctionsSubmitted: null, auditFinalized: null, reviewer: "",
        progressReview: "", remarks: "",
      },
      materialsReview: {
        numIssues: 0, exceptions: 0, reviewStart: null, auditGiven: null, correctionsDue: null,
        pccSignoffSent: null, pccSignoffRcvd: null, hmaSignoffSent: null, hmaSignoffRcvd: null,
        soilsSignoffSent: null, soilsSignoffRcvd: null, materialsCertDate: null,
        exceptionLetterDate: null, reviewer: "", remarks: "",
      },
      performancePeriod: [],
      dbeCloseOut: {
        commitmentPct: 0, bc2115: false, allSbe2115: false, approved: false, goalMet: false,
        dbeFinalDocSbe2028: false, waiverRequested: false, waiverGranted: false,
        packet2028Approved: false, eeoRemarks: "", eeoRepresentative: "",
      },
    },
  };
}

/** The 32 real samples (my_samples.json), mapped to the Sample type with fresh
 * generated identifiers + Test IDs (the source leaves them blank). */
function loadRealSamples(): Sample[] {
  return mySamples.map((s, i): Sample => {
    const seq = i + 1;
    return {
      id: `smp_real_${seq}`,
      sampleIdentifier: `SMP-${100000 + seq}`,
      testId: String(50000 + seq),
      inspectionType: s.inspectionType,
      inspector: s.inspector,
      sampleDate: parseLegacyDate(s.sampleDate) ?? "",
      totalSamples: s.totalSamples,
      materialCode: s.materialCode,
      materialName: s.materialName,
      desc1: s.desc1 ?? "",
      desc2: s.desc2 ?? "",
      desc3: s.desc3 ?? "",
      specialId: s.specialId ?? "",
      inspectedQty: s.inspectedQty,
      materialUnit: s.unit,
      producerNumber: s.producerNumber,
      producerName: s.producerName,
      supplierNumber: s.supplierNumber,
      supplierName: s.supplierName,
      sampledFrom: s.sampledFrom,
      latitude: "",
      longitude: "",
      specYear: s.specYear,
      dsaBaba: s.dsaBaba,
      responsibleLab: s.responsibleLab,
      contractId: s.contract ? realContractId(s.contract) : null,
      payItemNumber: null,
      inventoryItemId: null,
      receivedDate: parseLegacyDate(s.receivedDate),
      startedDate: parseLegacyDate(s.startedDate),
      completedDate: parseLegacyDate(s.completedDate),
      status: s.status as SampleStatus,
      approverName: s.approverName ?? "",
      approvedDate: parseLegacyDate(s.approvedDate),
      note: "",
      hasDocument: false,
    };
  });
}

export function generateWorld(config: SeedConfig = DEFAULT_SEED_CONFIG): World {
  const root = makeRng(MASTER_SEED);
  const contracts: Contract[] = [];
  const payItemsByContract = new Map<string, PayItem[]>();

  for (let i = 0; i < config.contracts; i++) {
    const cRng = makeRng(`${MASTER_SEED}:contract:${i}`);
    const contract = generateContract(i, cRng);
    contracts.push(contract);
    payItemsByContract.set(contract.id, generatePayItems(contract, cRng));
  }

  // Real projects (my_projects.json) — added so the 32 real samples link to a
  // real contract. Minimal/empty; no pay items until the user fills them in.
  for (const p of myProjects) {
    const real = makeRealContract(p);
    contracts.push(real);
    payItemsByContract.set(real.id, []);
  }

  // 61D34 — a fully migrated real contract: rich metadata, 257 plan pay items,
  // and 28 real inventory rows (appended below, after status assignment).
  contracts.push(CONTRACT_61D34);
  payItemsByContract.set(CONTRACT_61D34.id, PAY_ITEMS_61D34);

  // Distribute inventory items across contracts with a realistic spread:
  // most contracts modest, a few large. Weighted by contract index hash.
  const sizes = contracts.map((c) => {
    const r = makeRng(`${MASTER_SEED}:size:${c.id}`);
    // base size + occasional large contract
    return r.bool(0.12) ? r.int(90, 220) : r.int(8, 70);
  });
  const sizeTotal = sizes.reduce((a, b) => a + b, 0);
  const scale = config.inventoryItems / sizeTotal;
  const scaledSizes = sizes.map((s) => Math.max(3, Math.round(s * scale)));

  const items: InventoryItem[] = [];
  let serial = 1;

  contracts.forEach((contract, ci) => {
    // 61D34 carries its own real inventory (appended after status assignment).
    if (contract.id === CONTRACT_61D34.id) return;
    const payItems = payItemsByContract.get(contract.id)!;
    const iRng = makeRng(`${MASTER_SEED}:inv:${contract.id}`);
    const size = scaledSizes[ci];
    let lastTuple: { m: Material; p: Vendor; s: Vendor } | null = null;

    for (let k = 0; k < size; k++) {
      // intentional duplicates: occasionally reuse the previous tuple.
      let material: Material, producer: Vendor, supplier: Vendor;
      if (lastTuple && iRng.bool(0.1)) {
        ({ m: material, p: producer, s: supplier } = lastTuple);
      } else {
        material = iRng.pick(MATERIALS);
        producer = producerFor(material, iRng);
        supplier = iRng.pick(SUPPLIERS);
        lastTuple = { m: material, p: producer, s: supplier };
      }

      const matchingPayItems = payItems.filter(
        (p) => PAY_ITEM_TEMPLATES.find((t) => t.code === p.number)?.family === material.family,
      );
      const linked = (matchingPayItems.length ? matchingPayItems : payItems);
      const payItemNumbers = iRng.sample(linked, iRng.bool(0.2) ? 2 : 1).map((p) => p.number);

      items.push({
        id: `inv_${serial}`,
        inventoryId: String(100000 + serial),
        contractId: contract.id,
        contractNumber: contract.number,
        materialCode: material.code,
        materialName: material.name,
        materialUnit: material.unit,
        producerNumber: producer.number,
        producerName: producer.name,
        supplierNumber: supplier.number,
        supplierName: supplier.name,
        status: "Needs Attention", // assigned below
        note: iRng.bool(0.15) ? iRng.pick(NOTES) : "",
        payItemNumbers,
        readyAt: null,
      });
      serial++;
    }
  });

  // Assign statuses with a global budget for "Ready for Review".
  assignStatuses(items, config.readyForReviewCount, root);
  injectDuplicateClusters(items, contracts, payItemsByContract);

  // 61D34's real inventory — appended after status assignment so every row keeps
  // its "Needs Attention" default (these are freshly migrated, not yet reviewed).
  items.push(...INVENTORY_61D34);

  // Denormalize counts onto contracts.
  const byContract = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const arr = byContract.get(it.contractId);
    if (arr) arr.push(it);
    else byContract.set(it.contractId, [it]);
  }
  for (const c of contracts) {
    const arr = byContract.get(c.id) ?? [];
    c.inventoryCount = arr.length;
    c.readyForReviewCount = arr.filter((i) => i.status === "Ready for Review").length;
  }

  // Samples are the user's 32 real samples only — no synthetic generation.
  const samples = loadRealSamples();
  const tests: Test[] = [];

  const suspensionsByContract = new Map<string, DiarySuspension[]>();
  for (const c of contracts) suspensionsByContract.set(c.id, generateSuspensions(c.id));

  const placements = generatePlacements(contracts, payItemsByContract);
  const payEstimates = generatePayEstimates(contracts, payItemsByContract, placements);
  const authorizations = generateAuthorizations(contracts, payItemsByContract);

  return {
    contracts,
    items,
    payItemsByContract,
    samples,
    tests,
    testTemplates: TEST_TEMPLATES,
    suspensionsByContract,
    placements,
    payEstimates,
    authorizations,
    mixDesigns: generateMixDesigns(),
  };
}

/** A few authorizations per contract (Ch. 7) — brief 10. */
function generateAuthorizations(contracts: Contract[], payItemsByContract: Map<string, PayItem[]>): Authorization[] {
  const out: Authorization[] = [];
  for (const c of contracts) {
    const rng = makeRng(`${MASTER_SEED}:auth:${c.id}`);
    const n = rng.weighted<number>([[0, 3], [1, 3], [2, 3], [3, 1]]);
    const payItems = payItemsByContract.get(c.id) ?? [];
    for (let k = 1; k <= n; k++) {
      const type = rng.weighted<AuthType>([["Standard", 6], ["Overage/Balancing", 3], ["Major Change", 1]]);
      const itemCount = rng.int(1, 3);
      const items = Array.from({ length: itemCount }, () => {
        const existing = payItems.length && rng.bool(0.7);
        const pi = existing ? rng.pick(payItems) : null;
        const qty = rng.float(-200, 800, 0);
        return {
          payItemNumber: pi?.number ?? `999${rng.int(1000, 9999)}`,
          description: pi?.description ?? "NEW ITEM — FIELD CHANGE",
          unit: pi?.unit ?? "EACH",
          quantity: qty,
          unitPrice: pi?.unitPrice ?? rng.float(5, 500),
          isNew: !pi,
        };
      });
      const netChange = Math.round(sumAmounts(items.map((i) => lineAmount(i.quantity, i.unitPrice))) * 100) / 100;
      const steps = AUTH_STEPS[type];
      const status = rng.weighted<Authorization["status"]>([["Published", 5], ["In Approval", 3], ["Draft", 2]]);
      const signedCount = status === "Published" ? steps.length : status === "In Approval" ? rng.int(0, steps.length - 1) : 0;
      const createdEpoch = Date.now() - rng.int(20, 300) * MS_DAY;
      const approvals: AuthApproval[] = steps.map((step, i) => ({
        step,
        approver: i < signedCount ? rng.pick(STAFF_NAMES) : null,
        approvedAt: i < signedCount ? isoDate(createdEpoch + (i + 1) * rng.int(2, 10) * MS_DAY) : null,
      }));
      out.push({
        id: `auth_${c.id}_${k}`,
        contractId: c.id,
        number: k,
        type,
        description: rng.pick(["Field-directed quantity change", "Balancing overage to plan", "Added drainage work", "Traffic control revision", "Unforeseen subgrade repair"]),
        netChange,
        status,
        createdDate: isoDate(createdEpoch),
        items,
        approvals,
        hasAttachment: rng.bool(0.7),
      });
    }
  }
  return out;
}

/** Prior pay estimates per active contract; marks included placements (brief 09). */
function generatePayEstimates(
  contracts: Contract[],
  payItemsByContract: Map<string, PayItem[]>,
  placements: PlacementEntry[],
): PayEstimate[] {
  const out: PayEstimate[] = [];
  const byContract = new Map<string, PlacementEntry[]>();
  for (const p of placements) {
    const arr = byContract.get(p.contractId);
    if (arr) arr.push(p);
    else byContract.set(p.contractId, [p]);
  }
  for (const c of contracts) {
    if (c.summary.contractStatus !== "Active" && c.summary.contractStatus !== "Completed") continue;
    const rng = makeRng(`${MASTER_SEED}:payest:${c.id}`);
    const count = rng.weighted<number>([[0, 2], [1, 3], [2, 3]]);
    if (count === 0) continue;
    const payItems = payItemsByContract.get(c.id) ?? [];
    const eligible = (byContract.get(c.id) ?? []).filter((p) => p.type === "Placed" && p.posted).sort((a, b) => a.date.localeCompare(b.date));
    let toDate = 0;
    for (let k = 1; k <= count; k++) {
      const slice = eligible.slice((k - 1) * Math.ceil(eligible.length / (count + 1)), k * Math.ceil(eligible.length / (count + 1)));
      if (slice.length === 0) continue;
      const estId = `pe_${c.id}_${k}`;
      const byItem = new Map<string, PlacementEntry[]>();
      for (const p of slice) {
        p.payEstimateId = estId; // mark consumed
        const arr = byItem.get(p.payItemNumber);
        if (arr) arr.push(p);
        else byItem.set(p.payItemNumber, [p]);
      }
      const lines: PayEstimateLine[] = [...byItem.entries()].map(([num, ps]) => {
        const pi = payItems.find((x) => x.number === num);
        const qty = ps.reduce((s, p) => s + p.quantity, 0);
        const price = pi?.unitPrice ?? ps[0].price;
        return { payItemNumber: num, description: pi?.description ?? "—", unit: pi?.unit ?? "", quantityThis: qty, unitPrice: price, amount: lineAmount(qty, price) };
      });
      const thisTotal = sumAmounts(lines.map((l) => l.amount));
      toDate += thisTotal;
      const periodEnd = isoDate(Date.now() - (count - k) * 30 * MS_DAY - rng.int(1, 10) * MS_DAY);
      out.push({
        id: estId,
        contractId: c.id,
        number: k,
        periodStart: isoDate(new Date(periodEnd).getTime() - 28 * MS_DAY),
        periodEnd,
        status: k < count ? "Paid" : rng.weighted<PayEstimate["status"]>([["Submitted", 3], ["Approved", 2], ["Paid", 1]]),
        submittedBy: rng.pick(STAFF_NAMES),
        submittedAt: periodEnd,
        lines,
        thisEstimateTotal: thisTotal,
        toDateTotal: Math.round(toDate * 100) / 100,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Diary (brief 07) — suspensions seeded; days generated on demand + overlaid
// ---------------------------------------------------------------------------

function generateSuspensions(contractId: string): DiarySuspension[] {
  const rng = makeRng(`${MASTER_SEED}:susp:${contractId}`);
  if (!rng.bool(0.3)) return [];
  const fromDays = rng.int(120, 220);
  const toDays = rng.int(40, fromDays - 20);
  return [
    {
      contractId,
      from: isoDate(Date.now() - fromDays * MS_DAY),
      to: isoDate(Date.now() - toDays * MS_DAY),
      reason: rng.pick(["Winter shutdown", "Utility relocation delay", "Right-of-way hold", "Weather suspension"]),
    },
  ];
}

const WEATHER = ["Clear", "Partly Cloudy", "Cloudy", "Rain", "Showers", "Snow", "Windy", "Fog"];
const CONTROLLING = [
  "HMA surface course",
  "PCC pavement placement",
  "Structure excavation",
  "Reinforcement placement",
  "Pavement marking",
  "Aggregate base",
  "Bridge deck pour",
  "Guardrail installation",
];

/** Deterministic diary day for a (contract, date). Overlaid by saved deltas. */
export function buildDiaryDay(contract: Contract, date: string): DiaryDay {
  const rng = makeRng(`diary:${contract.id}:${date}`);
  const epoch = new Date(date + "T00:00:00").getTime();
  const isPast = epoch < Date.now() - MS_DAY;
  const dow = new Date(date + "T00:00:00").getDay();
  const isWeekend = dow === 0 || dow === 6;
  const high = rng.int(45, 92);
  const signed = isPast && !isWeekend && rng.bool(0.9);
  return {
    contractId: contract.id,
    date,
    weather: {
      conditions: rng.pick(WEATHER),
      tempHigh: high,
      tempLow: high - rng.int(8, 25),
      note: rng.bool(0.2) ? "Brief delay for weather." : "",
    },
    controllingItem: isWeekend ? "" : rng.pick(CONTROLLING),
    contractorWork: isWeekend
      ? []
      : [
          {
            contractor: contract.summary.primeContractor,
            summary: `${rng.pick(["Placed", "Formed", "Excavated", "Inspected", "Tested"])} ${rng.pick(CONTROLLING).toLowerCase()}; ${rng.int(4, 18)} crew on site.`,
          },
        ],
    projectLog: isWeekend ? "" : rng.pick(["Verbal direction given on grade.", "Discussed schedule with contractor.", "Noted minor punchlist items.", ""]),
    signedBy: signed ? rng.pick(STAFF_NAMES) : null,
    signedAt: signed ? date : null,
  };
}


const NOTES = [
  "Awaiting cert from producer.",
  "Split quantity across two pay items.",
  "Verify mix design on next delivery.",
  "Producer location confirmed.",
  "Test ID pending from district lab.",
  "Duplicate of earlier delivery — confirm.",
];

function assignStatuses(items: InventoryItem[], readyCount: number, rng: Rng): void {
  // Choose `readyCount` indices to be Ready for Review, the rest split between
  // Needs Attention (~22%) and Review Complete (rest).
  const idx = items.map((_, i) => i);
  // deterministic shuffle
  for (let i = idx.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const now = Date.now();
  const readySet = new Set(idx.slice(0, Math.min(readyCount, idx.length)));

  items.forEach((item, i) => {
    if (readySet.has(i)) {
      item.status = "Ready for Review";
      const daysAgo = makeRng(`age:${item.id}`).int(1, 130);
      const hours = makeRng(`hr:${item.id}`).int(0, 23);
      item.readyAt = now - daysAgo * MS_DAY - hours * 3_600_000;
    } else {
      const r = makeRng(`st:${item.id}`);
      item.status = r.bool(0.28) ? "Needs Attention" : "Review Complete";
      item.readyAt = null;
    }
  });
}

/**
 * Guarantee the approval inbox has dedup work: for a slice of contracts, force
 * 2–4 of their Ready-for-Review items to share material+producer+supplier.
 */
function injectDuplicateClusters(
  items: InventoryItem[],
  contracts: Contract[],
  _payItemsByContract: Map<string, PayItem[]>,
): void {
  const readyByContract = new Map<string, InventoryItem[]>();
  for (const it of items) {
    if (it.status !== "Ready for Review") continue;
    const arr = readyByContract.get(it.contractId);
    if (arr) arr.push(it);
    else readyByContract.set(it.contractId, [it]);
  }
  contracts.forEach((c, ci) => {
    if (ci % 5 !== 0) return; // ~40 contracts
    const ready = readyByContract.get(c.id);
    if (!ready || ready.length < 3) return;
    const r = makeRng(`dupe:${c.id}`);
    const clusterSize = r.int(2, 4);
    const template = ready[0];
    for (let k = 1; k < clusterSize && k < ready.length; k++) {
      const t = ready[k];
      t.materialCode = template.materialCode;
      t.materialName = template.materialName;
      t.materialUnit = template.materialUnit;
      t.producerNumber = template.producerNumber;
      t.producerName = template.producerName;
      t.supplierNumber = template.supplierNumber;
      t.supplierName = template.supplierName;
    }
  });
}

// ---------------------------------------------------------------------------
// On-demand detail (the four tabs)
// ---------------------------------------------------------------------------

export function buildDetail(item: InventoryItem, payItems: PayItem[]): InventoryDetail {
  const rng = makeRng(`detail:${item.id}`);
  const material = MATERIALS.find((m) => m.code === item.materialCode);

  // Quantity Ledger — 1..5 rows of received material.
  const ledgerCount = rng.int(1, 5);
  const ledger: LedgerEntry[] = [];
  const startEpoch = (item.readyAt ?? Date.now()) - rng.int(20, 90) * MS_DAY;
  for (let i = 0; i < ledgerCount; i++) {
    ledger.push({
      id: i + 1,
      date: isoDate(startEpoch + i * rng.int(1, 6) * MS_DAY),
      payItemNumber: item.payItemNumbers[0] ?? "",
      desc1: material?.family === "Steel" ? rng.pick(["4", "5", "6", "8"]) : "",
      desc2: material?.family === "Steel" ? rng.pick(["3543-14", "2394-10", "6024-04"]) : "",
      desc3: "",
      mixDesign: material?.family === "HMA" ? `80BIT${rng.int(1000, 9999)}` : "",
      batchLotHeat: rng.bool(0.6) ? `L${rng.int(19000000, 21999999)}` : "",
      type: rng.weighted<LedgerType>([["Received", 7], ["Tested", 2], ["Adjustment", 1]]),
      transactionQty: rng.float(40, 600, 2),
    });
  }

  // Evidence of Inspection — one row per ledger (sometimes combined).
  const eoi: EOIEntry[] = ledger.map((l, i) => ({
    id: `${item.id}_eoi_${i + 1}`,
    ledgerIds: [l.id],
    actualEoi: rng.sample(EOI_CODES, rng.int(1, 3)),
    actualMoa: rng.sample(MOA_CODES, rng.int(1, 2)),
    testId: rng.bool(0.7) ? String(rng.int(2000, 29999)) : "",
    // unreviewed items mostly Unset; reviewed ones carry an approval.
    approval:
      item.status === "Review Complete"
        ? rng.weighted<EOIApproval>([["Approved", 8], ["Approved as Exception", 2]])
        : item.status === "Ready for Review"
          ? rng.weighted<EOIApproval>([["Unset", 7], ["Approved", 3]])
          : "Unset",
    note: "",
    hasDocument: rng.bool(0.5),
  }));

  // Pay Item Materials — provided vs. required per linked pay item (grouping.ts).
  const payItemMaterials = buildPayItemMaterials(item, payItems, ledger);

  return { ...item, ledger, eoi, payItemMaterials };
}

// ---------------------------------------------------------------------------
// Overlay persisted write-deltas onto the generated detail (brief 05). Shared by
// the store selector and the inventory drawer so they never disagree.
// ---------------------------------------------------------------------------

export interface DetailDeltas {
  eoiApproval: Record<string, { approval: EOIApproval; note: string }>;
  ledger: Record<string, LedgerEntry[]>;
  eoiRows: Record<string, EOIEntry[]>;
  payItemStatus: Record<string, { status: PayItemMaterialStatus; note: string }>;
}

export function buildOverlaidDetail(
  item: InventoryItem,
  payItems: PayItem[],
  d: DetailDeltas,
): InventoryDetail {
  const base = buildDetail(item, payItems);
  const ledger = d.ledger[item.id] ?? base.ledger;

  let eoi = d.eoiRows[item.id] ?? base.eoi;
  eoi = eoi.map((row) => {
    const a = d.eoiApproval[`${item.id}:${row.id}`];
    return a ? { ...row, approval: a.approval, note: a.note } : row;
  });

  const payItemMaterials = buildPayItemMaterials(item, payItems, ledger).map((r) => {
    const o = d.payItemStatus[`${item.id}:${r.payItemNumber}`];
    return o ? { ...r, payItemMaterialStatus: o.status } : r;
  });

  return { ...base, ledger, eoi, payItemMaterials };
}
