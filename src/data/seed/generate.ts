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
  PayItemMaterialRow,
  GroupStatus,
  Material,
  Vendor,
} from "@/domain/types";
import { makeRng, type Rng } from "./rng";

export const MASTER_SEED = "proof-cmms-v1";
const MS_DAY = 86_400_000;

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
}

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

// material family → likely producers (loose, for coherence). Falls back to all.
const PRODUCERS_BY_FAMILY: Record<string, string[]> = {
  HMA: ["2112-14", "2118-03", "5011-04", "5260-10"],
  Paint: ["3181-05", "3320-06", "3702-09", "9255-03"],
  Concrete: ["1668-12", "1702-05", "2240-07", "1266-02"],
  Aggregate: ["51230-09", "1845-11", "1990-08", "4120-02", "5533-01"],
  Steel: ["3543-14", "2394-10", "6024-04", "4455-13", "3454-02"],
  Soil: ["75000-00"],
  Hardware: ["2010-02", "4455-13"],
  Other: ["1266-02", "5011-04"],
};

function producerFor(material: Material, rng: Rng): Vendor {
  const pool = PRODUCERS_BY_FAMILY[material.family] ?? [];
  const numbers = pool.length ? pool : PRODUCERS.map((p) => p.number);
  const num = rng.pick(numbers);
  return PRODUCERS.find((p) => p.number === num) ?? PRODUCERS[0];
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
    };
  });
}

/** Build the full world deterministically. */
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

  return { contracts, items, payItemsByContract };
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
  const conversionFactor = material?.conversionFactor ?? 1;

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

  // Pay Item Materials — provided vs. required per linked pay item.
  const provided = ledger
    .filter((l) => l.type === "Received")
    .reduce((s, l) => s + l.transactionQty, 0);
  const payItemMaterials: PayItemMaterialRow[] = item.payItemNumbers.map((num, i) => {
    const pi = payItems.find((p) => p.number === num);
    const placed = pi?.placedQuantity ?? rng.float(200, 4000, 0);
    const required = Math.round(placed * conversionFactor * 100) / 100;
    const share = item.payItemNumbers.length > 1 ? provided / item.payItemNumbers.length : provided;
    const balance = Math.round((share - required) * 100) / 100;
    const groupStatus: GroupStatus = balance >= 0 ? "Satisfactory" : "Deficient";
    return {
      payItemNumber: num,
      payItemDescription: pi?.description ?? "—",
      payItemUnit: pi?.unit ?? "",
      placedQuantity: placed,
      group: String.fromCharCode(65 + i),
      materialQuantityProvided: Math.round(share * 100) / 100,
      materialUnit: item.materialUnit,
      conversionFactor,
      materialQuantityRequired: required,
      balance,
      groupStatus,
      payItemMaterialStatus:
        item.status === "Review Complete"
          ? groupStatus === "Satisfactory"
            ? "Approved"
            : "Deficient"
          : groupStatus === "Satisfactory"
            ? "Approved"
            : "Deficient",
    };
  });

  return { ...item, ledger, eoi, payItemMaterials };
}
