/**
 * Real-project demo data. The 32 logged-in samples (my_samples.json) carry real
 * material codes, producers, quantities, and Test IDs — but their contracts had
 * no inventory, so nothing exercised the Test-ID-match / usage features. This
 * module turns each sample into a coherent inventory record on the sample's
 * contract: same material + producer + supplier (so the Test ID dropdown matches
 * by material AND producer), a filled Quantity Ledger that draws down part of the
 * sample's logged quantity, and an Evidence-of-Inspection row tied back to the
 * sample's Test ID. The result is a fully populated demo where Test ID usage,
 * gray-out, and the usage page all have live numbers.
 *
 * Everything is deterministic (seeded by id) so loads are byte-identical.
 */
import type {
  EOIEntry,
  InventoryItem,
  InventoryStatus,
  LedgerEntry,
  PayItem,
  Sample,
} from "@/domain/types";
import { MATERIALS } from "@/data/reference";
import { makeRng } from "./rng";

const MS_DAY = 86_400_000;

/** A steel-reinforcement pay item to anchor rebar inventory (the bulk of the samples). */
function payItemForMaterial(awardedQty: number, unit: string): PayItem {
  return {
    number: "50800205",
    description: "REINFORCEMENT BARS, EPOXY COATED",
    unit: unit || "POUND",
    unitPrice: 1.42,
    awardedQuantity: Math.round(awardedQty),
    placedQuantity: Math.round(awardedQty * 0.62),
    fundKey: "0001",
    final: false,
  };
}

export interface RealProjectData {
  /** pay items keyed by real contract id (merged onto the world map) */
  payItemsByContract: Map<string, PayItem[]>;
  /** inventory items (each carries a baked seedDetail) */
  items: InventoryItem[];
  /** test-id → inventory-item links to stamp back onto the samples */
  sampleLinks: { sampleId: string; inventoryItemId: string; payItemNumber: string }[];
}

/** Build inventory + pay items for the real projects from their samples. */
export function buildRealProjectData(
  samples: Sample[],
  realContractNumbers: Set<string>,
): RealProjectData {
  const payItemsByContract = new Map<string, PayItem[]>();
  const items: InventoryItem[] = [];
  const sampleLinks: RealProjectData["sampleLinks"] = [];

  // Only samples that landed on one of the real projects (not 61D34, not null).
  const eligible = samples.filter((s) => s.contractId && realContractNumbers.has(contractNumberOf(s.contractId)));

  eligible.forEach((sample, i) => {
    const contractId = sample.contractId!;
    const contractNumber = contractNumberOf(contractId);
    const rng = makeRng(`realinv:${sample.id}`);
    const material = MATERIALS.find((m) => m.code === sample.materialCode);
    const conversionFactor = material?.conversionFactor ?? 1;

    // How much of this sample's logged quantity the inventory draws down. A
    // deterministic spread: most partial, a couple intentionally over capacity
    // (used up → red), a few light. Units line up — both are the material unit.
    const fractionPick = i % 7;
    const consumedFraction =
      fractionPick === 2 ? 1.05 : fractionPick === 5 ? 1.0 : fractionPick === 0 ? 0.25 : rng.float(0.35, 0.78);
    const totalDrawn = Math.round(sample.inspectedQty * consumedFraction * 100) / 100;

    // Status mix: a slice is left Ready-for-Review (unset approvals) so the
    // reviewer can run the PDF flow live; Approved samples complete; the rest
    // need attention. Logged-In samples are never "complete".
    const status: InventoryStatus =
      i % 4 === 0
        ? "Ready for Review"
        : sample.status === "Approved"
          ? "Review Complete"
          : "Needs Attention";
    const approved = status === "Review Complete";

    // Anchor pay item — sized so placed × cf ≈ drawn (Pay Item Materials balances).
    const payQty = conversionFactor > 0 ? totalDrawn / conversionFactor : totalDrawn;
    const payItem = payItemForMaterial(payQty / 0.62, sample.materialUnit);
    payItemsByContract.set(contractId, [payItem]);

    const id = `inv_real_${contractNumber}_s${i + 1}`;
    const base = Date.now() - rng.int(30, 120) * MS_DAY;
    const ledgerRowCount = totalDrawn > 0 ? rng.int(1, 2) : 1;

    const ledger: LedgerEntry[] = [];
    let remaining = totalDrawn;
    for (let k = 0; k < ledgerRowCount; k++) {
      const last = k === ledgerRowCount - 1;
      const qty = last ? remaining : Math.round((remaining / (ledgerRowCount - k)) * 100) / 100;
      remaining = Math.round((remaining - qty) * 100) / 100;
      ledger.push({
        id: k + 1,
        date: isoDate(base + k * rng.int(3, 12) * MS_DAY),
        payItemNumber: payItem.number,
        desc1: sample.desc1 || "",
        desc2: sample.desc2 || "",
        desc3: sample.desc3 || "",
        mixDesign: "",
        batchLotHeat: sample.specialId?.replace(/^.*?(\d{5,}).*$/, "$1") || `L${rng.int(19000000, 21999999)}`,
        type: "Received",
        transactionQty: Math.max(0, qty),
      });
    }

    const acceptableEoi = material?.acceptableEoi?.length ? material.acceptableEoi.slice(0, 2) : ["CERT"];
    const moa = moaFrom(material?.moa);
    const eoi: EOIEntry[] = [
      {
        id: `${id}_eoi_1`,
        ledgerIds: ledger.map((l) => l.id), // one EOI row can cover several ledger lines (PDF "Ledger ID 1-3")
        actualEoi: acceptableEoi,
        actualMoa: moa,
        testId: sample.testId, // the real, matching Test ID
        approval: approved ? "Approved" : "Unset",
        note: approved ? `CERT package verified against Test ID ${sample.testId}.` : "",
        hasDocument: true,
      },
    ];

    items.push({
      id,
      inventoryId: String(700000 + i + 1),
      contractId,
      contractNumber,
      materialCode: sample.materialCode,
      materialName: sample.materialName,
      materialUnit: sample.materialUnit,
      producerNumber: sample.producerNumber,
      producerName: sample.producerName,
      supplierNumber: sample.supplierNumber,
      supplierName: sample.supplierName,
      status,
      seedStatus: status,
      note: "",
      payItemNumbers: [payItem.number],
      readyAt: status === "Ready for Review" ? base : null,
      effectiveDate: isoDate(base),
      seedDetail: { ledger, eoi },
      createdBy: sample.inspector || "Gerardo Sanchez II",
      createdByOrg: "IDOT",
      updatedBy: sample.inspector || "Gerardo Sanchez II",
      updatedByOrg: "IDOT",
      version: 1,
    });

    sampleLinks.push({ sampleId: sample.id, inventoryItemId: id, payItemNumber: payItem.number });
  });

  return { payItemsByContract, items, sampleLinks };
}

/** `ct_real_61K52` → `61K52`. */
function contractNumberOf(contractId: string): string {
  return contractId.replace(/^ct_real_/, "");
}

function moaFrom(moa: string | undefined): string[] {
  if (!moa) return ["CERT"];
  const codes = moa
    .toUpperCase()
    .split(/[^A-Z]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return codes.length ? [...new Set(codes)] : ["CERT"];
}

function isoDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}
