/**
 * Real contract 61D34 — migrated from the legacy IDOT construction system.
 * Full metadata (summary, insurance, subcontractors, project documents),
 * 257 plan pay items, and the 28 real inventory records. The source of truth is
 * the build brief + attached datasets; everything renders flat on the contract
 * page (no tabs / accordions for this contract's data).
 */
import type {
  Contract,
  ContractSummary,
  InventoryItem,
  PayItem,
  ProjectDocumentRow,
  SubcontractorRow,
} from "@/domain/types";
import payItemsRaw from "@/data/reference/61D34_pay_items.json";
import inventoryRaw from "@/data/reference/61D34_inventory.json";

const NUMBER = "61D34";
// Keep in sync with realContractId() in generate.ts (inlined to avoid a circular import).
const ID = `ct_real_${NUMBER}`;

// --- Pay items (257 from the plan) -----------------------------------------
// Source schema: { code, description, unit, totalQuantity, isSpecialtyItem }.
// Unit price isn't in the plan extract; left 0 until the bid tab is loaded.
export const PAY_ITEMS_61D34: PayItem[] = (
  payItemsRaw as {
    code: string;
    description: string;
    unit: string;
    totalQuantity: number;
    isSpecialtyItem: boolean;
  }[]
).map((p) => ({
  number: p.code,
  description: p.description,
  unit: p.unit,
  unitPrice: 0,
  awardedQuantity: p.totalQuantity,
  placedQuantity: 0,
  final: false,
  isSpecialtyItem: p.isSpecialtyItem,
}));

// --- Inventory (28 real records) -------------------------------------------
// Legacy gives one vendor per line (the producer/source) plus a trailing
// heat/inventory ID. New items default to "Needs Attention" until reviewed.
export const INVENTORY_61D34: InventoryItem[] = (
  inventoryRaw as {
    code: string;
    description: string;
    producerNumber: string;
    producerName: string;
    heatId: string;
  }[]
).map((r, i) => ({
  id: `inv_real_${NUMBER}_${i + 1}`,
  inventoryId: r.heatId || String(i + 1),
  contractId: ID,
  contractNumber: NUMBER,
  materialCode: r.code,
  materialName: r.description,
  materialUnit: "",
  producerNumber: r.producerNumber,
  producerName: r.producerName,
  supplierNumber: "",
  supplierName: "",
  status: "Needs Attention",
  note: "",
  payItemNumbers: [],
  readyAt: null,
}));

// --- Contract metadata ------------------------------------------------------

const summary: ContractSummary = {
  jobDescription:
    "PAVEMENT WIDENING AND RECONSTRUCTION; INCLUDES RESURFACING, TRAFFIC SIGNALS AND LIGHTINGS AT THE INTERSECTION OF BELL ROAD AND 143RD ST",
  section: "12-00147-11-CH",
  route: "FAP 356, FAU 1600",
  county: "Will",
  district: 1,
  projectNumber: "C9144612", // Job Number
  federalProjectNumber: "AJKB-163",
  contractStatus: "Active",
  primeContractor: "D. Construction, Inc.",
  primeContractorId: "1320",
  residentEngineer: "Jason Shuck",
  supervisingFieldEngineer: "Eric Ray",
  districtConstructionEngineer: "",
  designerFirm: "Epstein Engineering",
  projectImplementationEngineer: "",
  progressScheduleReceived: null,
  ehsPlanReceived: null,
  dbeProgramReceived: null,
  lettingDate: "2024-04-26",
  awardDate: "2024-06-06",
  executedDate: "2024-06-25",
  noticeToProceedDate: null,
  workBeginDate: "2025-04-01", // Contract Start Date
  contractCompletionDate: "2027-11-05",
  finalInspectionDate: null,
  contractSuspendedDate: "2024-07-10", // Diary Suspended Date
  engineersEstimate: 0,
  awardedAmount: 24_310_459.54,
  currentContractAmount: 24_682_483.34, // Adjusted Contract Value
  totalPaidToDate: 3_653_952.96, // Completed Amount
  dbeGoalPct: 24,
  dbeCommittedPct: 24,
  adjustmentAmount: 372_023.8, // Net Change
  primaryWorkType: "Pavement Widening & Reconstruction",
  terrain: "",
  funding: "Federal",
  specificationYear: "",
  units: "English",
  timeType: "Completion Date plus Working Days",
  originalContractTime: 15, // Contract Working Days
  currentContractTime: 15,
  timeChargedToDate: 0,
  liquidatedDamagesPerDay: 0,
  // Missing legacy fields (brief 19).
  markedRoute: "IL 7",
  county2: "",
  countyNo1: "099",
  ppsNumber: "P-91-446-12",
  bondingCompany: "Travelers Casualty and Surety Company of America",
  additions: 412_500.0,
  deductions: 40_476.2,
  hmaAdj: true,
  steelAdj: false,
  fuelAdj: true,
  trainees: true,
  residentPhone: "(815) 555-0147",
  consultantOrInHouse: "Consultant",
  contractWorkingDays: 15,
  workingDaysUsed: 0,
  contractCalendarDays: 0,
  workingDaysAdded: 0,
  calendarDaysAdded: 0,
  progressScheduleApproved: null,
  preconstructionMinutesDate: "2025-03-20",
  noticeOfIntentRequired: true,
  noticeOfIntentProcessed: null,
};

const subcontractors: SubcontractorRow[] = [
  { createDate: "2025-03-31", companyNumber: "13365", name: "Elmund and Nelson, Co." },
  { createDate: "2025-04-04", companyNumber: "17586", name: "Green Earth Landscaping, LLC" },
  { createDate: "2025-09-03", companyNumber: "14127", name: "J.A.C.K. Contractor Services Inc." },
  { createDate: "2025-06-23", companyNumber: "14592", name: "Kreative Scape Inc." },
  { createDate: "2025-04-10", companyNumber: "4055", name: "Midwest Fence Corporation" },
  { createDate: "2025-09-03", companyNumber: "6024", name: "STF, LLC d/b/a Traffic Control Company" },
  { createDate: "2025-06-23", companyNumber: "11577", name: "Work Zone Safety, Inc." },
];

// Visible set of the 81-doc legacy repository (bulk PDF import comes later).
const docSeed: { date: string; title: string; from: string }[] = [
  { date: "2026-06-12", title: "[External] Fw_ 61D34 - Pay Estimate #10", from: "shuckja" },
  { date: "2026-05-14", title: "[External] FW_ 61D34 - Pay Estimate #09", from: "shuckja" },
  { date: "2026-04-15", title: "[External] FW_ 61D34 - Pay Estimate #08", from: "shuckja" },
  { date: "2026-04-02", title: "pay estimate 2-7 approvals", from: "shuckja" },
  { date: "2026-02-16", title: "00049 Weekly Report_20260214", from: "FranklinT" },
  { date: "2026-02-09", title: "00048 Weekly Report_20260207", from: "FranklinT" },
  { date: "2026-02-09", title: "00047 Weekly Report_20260131", from: "FranklinT" },
  { date: "2026-02-02", title: "Bell Road 143rd St Progress Schedule REV2_01272026", from: "shuckja" },
  ...["00046", "00045", "00044", "00043", "00042", "00041", "00040"].map((n) => ({
    date: "2026-01-28",
    title: `${n} Weekly Report`,
    from: "FranklinT",
  })),
];

const projectDocuments: ProjectDocumentRow[] = docSeed.map((d, i) => ({
  id: `doc_61D34_${i + 1}`,
  date: d.date,
  title: d.title,
  subject: "Other",
  from: d.from,
  attachment: "",
  origin: "IDOT",
  hasFile: false,
}));

export const CONTRACT_61D34: Contract = {
  id: ID,
  number: NUMBER,
  name: "Bell Rd & 143rd St — Widening & Reconstruction",
  county: "Will",
  district: 1,
  workType: "Pavement Widening & Reconstruction",
  inventoryCount: INVENTORY_61D34.length,
  readyForReviewCount: 0,
  externalPlanLink: "https://apps.dot.illinois.gov/eplan/desenv/042624/",
  assignedInspectorIds: ["u_gerardo", "u_insp_2"],
  summary,
  insurance: {
    contractorNo: "1320",
    primeContractorName: "D. Construction, Inc.",
    itemNo: "204",
    finalAcceptanceDate: null,
    pctComplete: 12,
    pctCompleteDate: "2026-04-30",
    policies: [
      { kind: "General Liability", status: "Blanket Certification", expiration: "2027-06-01" },
      { kind: "Automotive Liability", status: "", expiration: "2027-06-01" },
      { kind: "Umbrella Liability", status: "", expiration: "2027-06-01" },
      { kind: "Workman's Compensation", status: "", expiration: "2027-06-01" },
    ],
    railroad: [],
  },
  subcontractors,
  projectDocuments,
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
