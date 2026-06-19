/**
 * Domain types — the authoritative model from the CMMS training manual.
 * Field names and statuses are taken from the manual (Ch. 2, 8, 9, 10–14).
 * Nothing the manual shows is dropped.
 */

// ---------------------------------------------------------------------------
// Users / roles / scope (brief 02) — the multi-user model
// ---------------------------------------------------------------------------

export type Role =
  | "Inspector"
  | "ResidentEngineer"
  | "Contractor"
  | "Documentation"
  | "DistrictAdmin";

export const ROLES: Role[] = [
  "Inspector",
  "ResidentEngineer",
  "Contractor",
  "Documentation",
  "DistrictAdmin",
];

/**
 * Party dimension (F2). Stamped on every mutable record so external
 * contractors / producers / labs can be invited in later WITHOUT re-stamping
 * the whole dataset. Everyone is "IDOT" for now.
 */
export type Party = "IDOT" | "Contractor" | "Producer" | "Supplier" | "Lab";
export const PARTIES: Party[] = ["IDOT", "Contractor", "Producer", "Supplier", "Lab"];

export interface User {
  id: string;
  name: string;
  roles: Role[];
  districtIds: number[]; // access to all contracts in these districts
  contractIds: string[]; // explicit per-contract access
  /** F2 — the org/party this user acts on behalf of. */
  orgId: string;
  party: Party;
  /** Appendix A admin fields (M5). */
  email?: string;
  title?: string;
  active?: boolean;
}

/**
 * Provenance (F2) — who/which org/when touched a record, plus a version for the
 * stale-write guard (P6). Stamped automatically through the store's `stamp`
 * helper; actions never hand-set these. Optional so seeds can backfill lazily.
 */
export interface Provenance {
  createdBy?: string;
  createdByOrg?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedByOrg?: string;
  updatedAt?: string;
  version?: number;
}

// ---------------------------------------------------------------------------
// Status sets (Ch. 14 — never invent these)
// ---------------------------------------------------------------------------

/** Inventory Status — Ch. 8 §8, Ch. 14. */
export type InventoryStatus = "Needs Attention" | "Ready for Review" | "Review Complete";
export const INVENTORY_STATUSES: InventoryStatus[] = [
  "Needs Attention",
  "Ready for Review",
  "Review Complete",
];

/** Evidence of Inspection approval — Ch. 14 "Reviewing EOI". */
export type EOIApproval = "Unset" | "Approved" | "Approved as Exception" | "Rejected";
export const EOI_APPROVALS: Exclude<EOIApproval, "Unset">[] = [
  "Approved",
  "Approved as Exception",
  "Rejected",
];

/** Pay Item Materials status — Ch. 14 "Reviewing Pay Item Materials". */
export type PayItemMaterialStatus = "Approved" | "Approved as Exception" | "Deficient";
export const PAY_ITEM_MATERIAL_STATUSES: PayItemMaterialStatus[] = [
  "Approved",
  "Approved as Exception",
  "Deficient",
];

/** Group Status — derived from the balance (Ch. 8 grouping). */
export type GroupStatus = "Satisfactory" | "Deficient";

/** Quantity Ledger transaction type — Ch. 8. */
export type LedgerType = "Received" | "Tested" | "Adjustment";
export const LEDGER_TYPES: LedgerType[] = ["Received", "Tested", "Adjustment"];

// ---------------------------------------------------------------------------
// Reference entities
// ---------------------------------------------------------------------------

export interface Material {
  code: string; // e.g. "19522R"
  name: string; // e.g. "HMA BC N70 19.0"
  unit: string; // material unit of measure (Tons, Gallons, Each, …)
  family: MaterialFamily;
  /** preset material conversion factor (material qty required per pay unit) */
  conversionFactor: number;
  /** method of acceptance (Ch. 9 / 13) */
  moa: string;
  /** acceptable Evidence of Inspection codes for this material */
  acceptableEoi: string[];
  // Real CMMS Part 3 fields (MMI 3/13/2026) — brief 14.
  group?: string;
  specialId?: string;
  sampleSize?: string;
  materialOwner?: string;
  babaDsa?: string;
  remark?: string;
  specifications?: string;
}

export type MaterialFamily =
  | "HMA"
  | "Paint"
  | "Concrete"
  | "Aggregate"
  | "Steel"
  | "Soil"
  | "Hardware"
  | "Other";

/** Mix Design (Ch. 9 / 13) — brief 11. */
export interface MixDesign {
  number: string;
  materialCode: string;
  family: MaterialFamily;
  producer: string;
  approved: boolean;
  docUrl?: string;
}

export interface Vendor {
  number: string; // e.g. "2112-14"
  name: string; // e.g. "Advance Asphalt Co"
  city: string;
  state: string;
  // Real MISTIC master fields (5/22/26) — brief 14.
  zip?: string;
  street?: string;
  county?: string;
  district?: string;
  category?: string;
  active?: boolean;
}

export interface PayItem {
  number: string; // e.g. "44201794"
  description: string; // e.g. "CLASS D PATCHES, TYPE III, 12 INCH"
  unit: string; // pay item unit of measure (SQ YD, GAL, …)
  unitPrice: number;
  awardedQuantity: number;
  placedQuantity: number;
  fundKey?: string;
  final?: boolean; // "Final a pay item" (brief 08)
  /** Marked as a specialty item on the plan (gets a subtle tag in the UI). */
  isSpecialtyItem?: boolean;
}

/**
 * Pay-item → material association (Ch. 8 Material Associations, brief 17). One
 * Primary per pay item; the rest are Components. Each carries its own conversion
 * factor + effective/expiration window (legacy shows 1/1/1974 → 1/1/2080).
 */
export type MaterialAssociationType = "Primary" | "Component";
export interface MaterialAssociation {
  payItemNumber: string;
  materialCode: string;
  materialName: string;
  unit: string;
  materialType: MaterialAssociationType;
  conversionFactor: number;
  effectiveDate: string;
  expirationDate: string;
}

/** Authorizations (Ch. 7) — brief 10. */
export type AuthType = "Standard" | "Overage/Balancing" | "Major Change";
export const AUTH_TYPES: AuthType[] = ["Standard", "Overage/Balancing", "Major Change"];
export type AuthStatus = "Draft" | "In Approval" | "Published";

export interface AuthItem {
  payItemNumber: string;
  description: string;
  unit: string;
  quantity: number; // change in awarded quantity (+/−)
  unitPrice: number;
  isNew: boolean;
}

export interface AuthApproval {
  step: string;
  approver: string | null;
  approvedAt: string | null;
}

export interface Authorization extends Provenance {
  id: string;
  contractId: string;
  number: number;
  type: AuthType;
  description: string;
  netChange: number;
  status: AuthStatus;
  createdDate: string;
  items: AuthItem[];
  approvals: AuthApproval[];
  hasAttachment: boolean; // BC 24 etc.
}

/** Pay Estimate (Ch. 6) — brief 09. */
export type PayEstimateStatus = "Draft" | "Submitted" | "Approved" | "Paid";
export const PAY_ESTIMATE_STATUSES: PayEstimateStatus[] = ["Draft", "Submitted", "Approved", "Paid"];

export interface PayEstimateLine {
  payItemNumber: string;
  description: string;
  unit: string;
  quantityThis: number;
  unitPrice: number;
  amount: number;
}

export interface PayEstimate extends Provenance {
  id: string;
  contractId: string;
  number: number;
  periodStart: string;
  periodEnd: string;
  status: PayEstimateStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  lines: PayEstimateLine[];
  thisEstimateTotal: number;
  toDateTotal: number;
  /** M3 — the Final Pay Estimate (process-to-final-out, Appendix H). */
  isFinal?: boolean;
}

/** Quantity Book placement entry (Ch. 4) — brief 08. */
export interface PlacementEntry extends Provenance {
  id: string;
  payItemNumber: string;
  contractId: string;
  date: string;
  fundKey: string;
  type: "Placed" | "Adjustment";
  quantity: number;
  price: number;
  location: string;
  contractor: string;
  posted: boolean;
  payEstimateId: string | null;
  creator: string;
}

// ---------------------------------------------------------------------------
// Inventory (Ch. 8) — the hero entity
// ---------------------------------------------------------------------------

/** Top-level inventory row as shown in the Contract Inventory Summary grid (Ch. 8). */
export interface InventoryItem extends Provenance {
  id: string; // internal id
  inventoryId: string; // displayed "Inventory ID"
  contractId: string;
  contractNumber: string; // denormalized for the cross-contract inbox
  materialCode: string;
  materialName: string;
  materialUnit: string;
  producerNumber: string;
  producerName: string;
  supplierNumber: string;
  supplierName: string;
  /** null ⇒ blank Inventory Status (legacy allows it); excluded from review inbox. */
  status: InventoryStatus | null;
  note: string;
  payItemNumbers: string[]; // linked pay items (Details tab)
  /** epoch ms the item entered "Ready for Review" — drives "oldest waiting first". */
  readyAt: number | null;
  // Optional Details fields captured on create (brief 05).
  locationType?: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  /** Active/Inactive (legacy Inventory Details, brief 16). Undefined ⇒ active. */
  active?: boolean;
}

/** Full inventory detail — the four tabs. Generated on demand from the item seed. */
export interface InventoryDetail extends InventoryItem {
  ledger: LedgerEntry[];
  eoi: EOIEntry[];
  payItemMaterials: PayItemMaterialRow[];
}

/** Quantity Ledger row (Ch. 8 "Quantity Ledger Tab"). */
export interface LedgerEntry extends Provenance {
  id: number; // "Id" column — referenced by EOI rows
  date: string; // ISO date
  payItemNumber: string;
  desc1: string; // material-specific (e.g. Rebar Size). Often blank.
  desc2: string;
  desc3: string;
  mixDesign: string; // e.g. "80BIT1234"
  batchLotHeat: string; // e.g. "L19050193"
  type: LedgerType;
  transactionQty: number; // in material unit of measure
}

/** Evidence of Inspection row (Ch. 8 "Evidence of Inspection Tab", Ch. 14). */
export interface EOIEntry extends Provenance {
  id: string;
  ledgerIds: number[]; // references LedgerEntry.id (may be multiple)
  actualEoi: string[]; // TICK / TEST / DPR / LA-15 / LIST / CERT / MARK
  actualMoa: string[]; // TEST / QUAL / CERT
  testId: string; // may be blank
  approval: EOIApproval;
  note: string;
  hasDocument: boolean;
}

/** A row in the Pay Item Materials tab (Ch. 8) — provided vs. required. */
export interface PayItemMaterialRow {
  payItemNumber: string;
  payItemDescription: string;
  payItemUnit: string;
  placedQuantity: number;
  group: string; // PI Inv Group letter (A, B, …)
  materialQuantityProvided: number;
  materialUnit: string;
  conversionFactor: number;
  materialQuantityRequired: number;
  balance: number; // provided − required
  groupStatus: GroupStatus;
  payItemMaterialStatus: PayItemMaterialStatus;
}

// ---------------------------------------------------------------------------
// Contract (Ch. 2) — Summary tab, every field preserved
// ---------------------------------------------------------------------------

export interface Contract {
  id: string;
  number: string; // IDOT-style contract number, e.g. "76123"
  name: string;
  county: string;
  district: number;
  workType: string;
  /** quick counts for the tree / lists (denormalized from inventory) */
  inventoryCount: number;
  readyForReviewCount: number;
  summary: ContractSummary;
  // Contract node sub-tabs (brief 06)
  insurance: ContractInsurance;
  subcontractors: SubcontractorRow[];
  projectDocuments: ProjectDocumentRow[];
  finalReview: FinalReview;
  /** External plan/eplan link (e.g. IDOT eplan URL), shown on the contract page. */
  externalPlanLink?: string;
  /** P1 — inspector user ids assigned to this contract (the "my projects" lens). */
  assignedInspectorIds?: string[];
}

// --- Contract sub-tabs (Ch. 2) — Insurance / Documents / Subs / Final Review

export type PolicyKind =
  | "General Liability"
  | "Automotive Liability"
  | "Umbrella Liability"
  | "Workman's Compensation";

export interface ContractInsurance {
  contractorNo: string;
  primeContractorName: string;
  itemNo: string;
  finalAcceptanceDate: string | null;
  pctComplete: number;
  pctCompleteDate: string | null;
  policies: { kind: PolicyKind; status: string; expiration: string | null }[];
  railroad: {
    policyNo: string;
    company: string;
    expiration: string | null;
    approvalRequested: string | null;
    approvalReceipt: string | null;
    workCompleted: string | null;
  }[];
}

export interface SubcontractorRow {
  createDate: string;
  companyNumber: string;
  name: string;
}

export interface ProjectDocumentRow {
  id: string;
  date: string;
  title: string;
  subject: string; // category
  from: string;
  attachment: string;
  origin: string; // e.g. IDOT
  hasFile: boolean;
}

export interface FinalFromDistrict {
  deadlineForFinalFrcBills: string | null;
  finalInspectionLetters: string | null;
  allPayItemsFinal: boolean;
  fqSent: string | null;
  fqAgree: string | null;
  fqCertified: string | null;
  fqReceived: string | null;
  challengedFq: boolean;
  intentToFileClaim: boolean;
  claimL1: string | null;
  claimL2: string | null;
  claimResolved: string | null;
  qtyAdjustmentLetter: string | null;
  opsSignoff: string | null;
  finalInspectionBc71: string | null;
  fpeBc111: string | null;
  localAgencyCertBc608: string | null;
  recordsPayrollRetention: string | null;
  recordsLocation: string;
  stateCompletionNotice: string | null;
  forCoToReview: boolean;
  projectControlManager: string;
}

export interface DocumentationReview {
  recordsTurnedIn: string | null;
  auditStart: string | null;
  numIssues: number;
  auditGivenToResident: string | null;
  correctionsDue: string | null;
  correctionsSubmitted: string | null;
  auditFinalized: string | null;
  reviewer: string;
  progressReview: string;
  remarks: string;
}

export interface MaterialsReview {
  numIssues: number;
  exceptions: number;
  reviewStart: string | null;
  auditGiven: string | null;
  correctionsDue: string | null;
  pccSignoffSent: string | null;
  pccSignoffRcvd: string | null;
  hmaSignoffSent: string | null;
  hmaSignoffRcvd: string | null;
  soilsSignoffSent: string | null;
  soilsSignoffRcvd: string | null;
  materialsCertDate: string | null;
  exceptionLetterDate: string | null;
  reviewer: string;
  remarks: string;
}

export interface PerformancePeriodRow {
  type: string;
  required: string;
  yearPlaced: string;
  inspectionNeeded: boolean;
  repairsNeeded: boolean;
  letterSent: string | null;
  repairsMade: boolean;
  bond: string;
  approvedLetterSent: string | null;
}

export interface DbeCloseOut {
  commitmentPct: number;
  bc2115: boolean;
  allSbe2115: boolean;
  approved: boolean;
  goalMet: boolean;
  dbeFinalDocSbe2028: boolean;
  waiverRequested: boolean;
  waiverGranted: boolean;
  packet2028Approved: boolean;
  eeoRemarks: string;
  eeoRepresentative: string;
}

export interface FinalReview extends Provenance {
  finalFromDistrict: FinalFromDistrict;
  documentationReview: DocumentationReview;
  materialsReview: MaterialsReview;
  performancePeriod: PerformancePeriodRow[];
  dbeCloseOut: DbeCloseOut;
}

/**
 * Contract Summary fields (Ch. 2). Grouped to match the Phase-2 cards
 * (Contract Info, Dates/Key Info, Values, Work Type, Time Spec). Every field is
 * preserved; empty ones are hidden until editing.
 */
export interface ContractSummary {
  // Job Description / Contract Info
  jobDescription: string;
  section: string;
  route: string;
  county: string;
  district: number;
  projectNumber: string;
  federalProjectNumber: string;
  contractStatus: string; // Active / Suspended / Completed / Closed
  primeContractor: string;
  primeContractorId: string;

  // Construction & Designer
  residentEngineer: string;
  supervisingFieldEngineer: string;
  districtConstructionEngineer: string;
  designerFirm: string;
  projectImplementationEngineer: string;

  // Preconstruction submittals
  progressScheduleReceived: string | null; // ISO date or null
  ehsPlanReceived: string | null;
  dbeProgramReceived: string | null;

  // Letting & Contractor dates
  lettingDate: string | null;
  awardDate: string | null;
  executedDate: string | null;
  noticeToProceedDate: string | null;
  workBeginDate: string | null;
  contractCompletionDate: string | null;
  finalInspectionDate: string | null;
  contractSuspendedDate: string | null;

  // Contract cost / Values
  engineersEstimate: number;
  awardedAmount: number;
  currentContractAmount: number;
  totalPaidToDate: number;

  // DBE percentage & Adjustment
  dbeGoalPct: number;
  dbeCommittedPct: number;
  adjustmentAmount: number;

  // Work type
  primaryWorkType: string;
  terrain: string;
  funding: string; // Federal / State / Local
  specificationYear: string;
  units: string; // English / Metric

  // Contract time
  timeType: string; // Calendar Days / Working Days / Completion Date
  originalContractTime: number; // days (0 when completion-date type)
  currentContractTime: number;
  timeChargedToDate: number;
  liquidatedDamagesPerDay: number;

  // --- Missing legacy Summary fields (brief 19) — all optional/backfilled ---
  markedRoute?: string;
  county2?: string;
  county3?: string;
  countyNo1?: string;
  countyNo2?: string;
  countyNo3?: string;
  ppsNumber?: string;
  bondingCompany?: string;
  /** Value block — additions/deductions feed the derived Net Change. */
  additions?: number;
  deductions?: number;
  hmaAdj?: boolean;
  steelAdj?: boolean;
  fuelAdj?: boolean;
  trainees?: boolean;
  residentPhone?: string;
  consultantOrInHouse?: string; // "Consultant" | "In-House"
  // Time block
  contractWorkingDays?: number;
  workingDaysUsed?: number;
  contractCalendarDays?: number;
  workingDaysAdded?: number;
  calendarDaysAdded?: number;
  // Editable working submittals (calendar pickers)
  progressScheduleApproved?: string | null;
  preconstructionMinutesDate?: string | null;
  noticeOfIntentRequired?: boolean;
  noticeOfIntentProcessed?: string | null;
}

// ---------------------------------------------------------------------------
// Cross-contract review queue (Phase 1b)
// ---------------------------------------------------------------------------

/** A "Ready for Review" inventory item, decorated for the approval inbox. */
export interface ReviewQueueItem extends InventoryItem {
  contractName: string;
  /** ms waiting since readyAt — drives "oldest waiting first". */
  waitingMs: number;
  /** stable key for duplicate detection: contract + material + producer + supplier. */
  dedupeKey: string;
}

// ---------------------------------------------------------------------------
// Samples + Tests (Ch. 9–12) — the tested-material path (briefs 03–04)
// ---------------------------------------------------------------------------

export type SampleStatus =
  | "Logged In"
  | "In Testing"
  | "Tested"
  | "Validated"
  | "Approved"
  | "Rejected";
export const SAMPLE_STATUSES: SampleStatus[] = [
  "Logged In",
  "In Testing",
  "Tested",
  "Validated",
  "Approved",
  "Rejected",
];

export interface Sample extends Provenance {
  id: string;
  sampleIdentifier: string; // generated on save
  testId: string; // generated on save
  inspectionType: string; // ACC / PRO / IND / …
  inspector: string; // STAFF_NAMES
  sampleDate: string; // ISO
  totalSamples: number;
  materialCode: string;
  materialName: string;
  desc1: string;
  desc2: string;
  desc3: string;
  specialId: string;
  inspectedQty: number;
  materialUnit: string;
  producerNumber: string;
  producerName: string;
  supplierNumber: string;
  supplierName: string;
  sampledFrom: string; // jobsite / Manufacturer's Plant / …
  latitude: string;
  longitude: string;
  specYear: string;
  dsaBaba: boolean;
  responsibleLab: string;
  contractId: string | null;
  payItemNumber: string | null;
  inventoryItemId: string | null;
  receivedDate: string | null;
  startedDate: string | null;
  completedDate: string | null;
  status: SampleStatus;
  approverName: string;
  approvedDate: string | null;
  note: string;
  hasDocument: boolean;
}

export interface TestField {
  key: string;
  label: string;
  value: string;
  spec?: string;
  pass?: boolean;
}

export interface Test extends Provenance {
  id: string;
  sampleId: string;
  series: number; // 1..n
  testType: string;
  testedBy: string;
  testDate: string | null;
  fields: TestField[]; // template-driven per material
  validated: boolean;
  validatedBy: string;
  validatedAt: string | null;
}

export interface TestTemplate {
  materialFamily: MaterialFamily;
  testType: string;
  fields: { key: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Diary (Ch. 3) — brief 07
// ---------------------------------------------------------------------------

export interface DiaryWeather {
  conditions: string;
  tempHigh: number | null;
  tempLow: number | null;
  note: string;
}

export interface DiaryContractorWork {
  contractor: string;
  summary: string;
}

export interface DiaryDay extends Provenance {
  contractId: string;
  date: string; // ISO, one per day
  weather: DiaryWeather;
  controllingItem: string;
  contractorWork: DiaryContractorWork[]; // shared to contractor only once signed
  projectLog: string; // internal only — never visible to Contractor scope
  signedBy: string | null;
  signedAt: string | null;
}

export interface DiarySuspension {
  contractId: string;
  from: string;
  to: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Material Allowance (Ch. 5) — M1
// ---------------------------------------------------------------------------

/**
 * A Material Allowance line (manual Ch. 5) — pre-payment for stockpiled material
 * that flows into Pay Estimates. One row per material on a contract.
 */
export interface MaterialAllowanceLine extends Provenance {
  id: string;
  contractId: string;
  materialCode: string;
  materialName: string;
  payItemNumber: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** quantity × unitPrice, rounded to cents */
  allowanceAmount: number;
  invoiceNumber: string;
  receivedDate: string | null;
  note: string;
}

// ---------------------------------------------------------------------------
// QMP package (Ch. 10) — M2 (HMA/PCC quality-management package)
// ---------------------------------------------------------------------------

export type QmpStatus = "Draft" | "Assembled" | "Submitted" | "Accepted" | "Rejected";
export const QMP_STATUSES: QmpStatus[] = ["Draft", "Assembled", "Submitted", "Accepted", "Rejected"];

export interface QmpPackage extends Provenance {
  id: string;
  contractId: string | null;
  sampleId: string;
  materialCode: string;
  materialName: string;
  family: MaterialFamily;
  status: QmpStatus;
  /** test ids (Sample drawer Tests) assembled into the package */
  testIds: string[];
  /** required test-series checklist for the family */
  requiredSeries: { label: string; satisfied: boolean }[];
  note: string;
}

// ---------------------------------------------------------------------------
// File storage (S1) — the DataSource file seam every doc affordance rides on
// ---------------------------------------------------------------------------

/** A reference to a real stored file. Only the reference lands in the delta. */
export interface StoredFileRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** object URL (local) or public/signed URL (supabase); rehydrated on load */
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  /** optimistic "uploading…" placeholder until the background upload resolves */
  uploading?: boolean;
}

// ---------------------------------------------------------------------------
// Import Log (F4) — every ingestion run, surfaced from the delta log
// ---------------------------------------------------------------------------

export interface ImportLogEntry {
  id: string;
  source: string; // "csv" | "wctb" | "eplan"
  fileName: string;
  at: string;
  by: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
