/**
 * X5 — external-submission ingest sources (groundwork, dormant until a pilot).
 * Producer certs and lab results flow through the SAME F4 pipeline as CSV/WCTB,
 * landing as provenance-stamped deltas (F2) scoped by party (P5 RLS). With only
 * IDOT users active these are unused — they're the switch-on, not a launch.
 */
import type { RawRow } from "../pipeline";

/** A producer-submitted material certification batch. */
export interface ProducerCertPayload {
  org: string; // producer org id (party = Producer)
  contract: string;
  certs: { invId: string; code: string; material: string; certNo: string; date: string }[];
}

export function parseProducerCerts(p: ProducerCertPayload): { headers: string[]; rows: RawRow[] } {
  const headers = ["Inventory ID", "Contract", "Material Code", "Material Name", "Cert No", "Cert Date", "Submitted By Org"];
  const rows: RawRow[] = p.certs.map((c) => ({
    "Inventory ID": c.invId,
    Contract: p.contract,
    "Material Code": c.code,
    "Material Name": c.material,
    "Cert No": c.certNo,
    "Cert Date": c.date,
    "Submitted By Org": p.org,
  }));
  return { headers, rows };
}

/** A lab-submitted batch of test results. */
export interface LabResultPayload {
  org: string; // lab org id (party = Lab)
  results: { sampleId: string; testType: string; value: string; pass: boolean; date: string }[];
}

export function parseLabResults(p: LabResultPayload): { headers: string[]; rows: RawRow[] } {
  const headers = ["Sample ID", "Test Type", "Value", "Pass", "Date", "Submitted By Org"];
  const rows: RawRow[] = p.results.map((r) => ({
    "Sample ID": r.sampleId,
    "Test Type": r.testType,
    Value: r.value,
    Pass: r.pass ? "Yes" : "No",
    Date: r.date,
    "Submitted By Org": p.org,
  }));
  return { headers, rows };
}
