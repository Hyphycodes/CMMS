/**
 * F4 WCTB source — `parse` only. A WCTB extraction arrives as a nested payload;
 * this flattens it into the same RawRow[] the CSV source produces, so the rest of
 * the pipeline (normalize → stage → commit) is shared. A sample payload is
 * included so the Import Log surface can demo the second source end-to-end.
 */
import type { RawRow } from "../pipeline";

interface WctbPayload {
  contract: string;
  items: { invId?: string; code: string; material: string; unit?: string; producer?: string; producerNo?: string; supplier?: string; supplierNo?: string }[];
}

export function parseWctb(payload: WctbPayload): { headers: string[]; rows: RawRow[] } {
  const headers = ["Inventory ID", "Contract", "Material Code", "Material Name", "Unit", "Producer No", "Producer", "Supplier No", "Supplier"];
  const rows: RawRow[] = payload.items.map((it) => ({
    "Inventory ID": it.invId ?? "",
    Contract: payload.contract,
    "Material Code": it.code,
    "Material Name": it.material,
    Unit: it.unit ?? "",
    "Producer No": it.producerNo ?? "",
    Producer: it.producer ?? "",
    "Supplier No": it.supplierNo ?? "",
    Supplier: it.supplier ?? "",
  }));
  return { headers, rows };
}

/** A small WCTB-shaped payload for demoing the pipeline against contract 61D34. */
export const SAMPLE_WCTB: WctbPayload = {
  contract: "61D34",
  items: [
    { invId: "WCTB-1001", code: "20100100", material: "AGGREGATE BASE COURSE", unit: "TON", producer: "Vulcan Materials", producerNo: "2112-14", supplier: "Vulcan Materials", supplierNo: "2112-14" },
    { invId: "WCTB-1002", code: "44000100", material: "HMA SURFACE COURSE", unit: "TON", producer: "Gallagher Asphalt", producerNo: "3041-02", supplier: "Gallagher Asphalt", supplierNo: "3041-02" },
    { invId: "WCTB-1003", code: "63000100", material: "STEEL PLATE BEAM GUARDRAIL", unit: "FOOT", producer: "Trinity Highway", producerNo: "5520-09", supplier: "Midwest Fence", supplierNo: "4055" },
  ],
};
