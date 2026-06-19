/**
 * Supabase data source — ready to wire (set VITE_DATA_SOURCE=supabase plus
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Reads contracts, pay items, and
 * the 8,000 inventory rows from Postgres; persists review deltas (inventory
 * status/note as columns, EOI approvals in `eoi_reviews`).
 *
 * Per-item ledger / EOI detail stays deterministically generated client-side
 * (buildDetail) so the seed stays light — see DECISIONS.md D2. Swapping this for
 * fully DB-backed detail is a localized change here, never in the UI.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DataSource,
  LoadResult,
  InventoryStatusUpdate,
  EoiDelta,
} from "../dataSource";
import type {
  Contract,
  ContractSummary,
  InventoryItem,
  PayItem,
  EOIApproval,
  Sample,
  Test,
  LedgerEntry,
  EOIEntry,
  PayItemMaterialStatus,
  DiaryDay,
  DiarySuspension,
  PlacementEntry,
  PayEstimate,
  Authorization,
  MixDesign,
  MaterialFamily,
  FinalReview,
  MaterialAllowanceLine,
  QmpPackage,
} from "@/domain/types";
import type { SeedConfig, World } from "../seed/generate";
import { TEST_TEMPLATES } from "../seed/generate";

function client(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase data source selected but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. " +
        "Set them in .env.local, or use VITE_DATA_SOURCE=local.",
    );
  }
  return createClient(url, key);
}

export function createSupabaseDataSource(): DataSource {
  const db = client();

  return {
    name: "supabase",

    async flush(): Promise<number> {
      // Supabase writes are synchronous in each persist call; nothing is queued.
      return 0;
    },

    async loadWorld(_config: SeedConfig): Promise<LoadResult> {
      // RLS returns only the authenticated user's scoped rows (brief 02/12).
      const [
        contractsRes, payItemsRes, itemsRes, reviewsRes,
        samplesRes, testsRes, placementsRes, estimatesRes, authsRes, mixRes, suspRes,
        ledgersRes, eoiEntriesRes, pimRes, diaryRes,
      ] = await Promise.all([
        db.from("contracts").select("*"),
        db.from("pay_items").select("*"),
        db.from("inventory_items").select("*"),
        db.from("eoi_reviews").select("*"),
        db.from("samples").select("*"),
        db.from("tests").select("*"),
        db.from("placements").select("*"),
        db.from("pay_estimates").select("*"),
        db.from("authorizations").select("*"),
        db.from("mix_designs").select("*"),
        db.from("diary_suspensions").select("*"),
        db.from("quantity_ledgers").select("*"),
        db.from("eoi_entries").select("*"),
        db.from("pay_item_materials").select("*"),
        db.from("diary_days").select("*"),
      ]);
      if (contractsRes.error) throw contractsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const contracts: Contract[] = (contractsRes.data ?? []).map(rowToContract);
      const payItemsByContract = new Map<string, PayItem[]>();
      for (const row of payItemsRes.data ?? []) {
        const arr = payItemsByContract.get(row.contract_id) ?? [];
        arr.push(rowToPayItem(row));
        payItemsByContract.set(row.contract_id, arr);
      }
      const items: InventoryItem[] = (itemsRes.data ?? []).map(rowToItem);

      const eoiDeltas: Record<string, EoiDelta> = {};
      for (const r of reviewsRes.data ?? []) {
        eoiDeltas[`${r.item_id}:${r.eoi_id}`] = { approval: r.approval, note: r.note ?? "" };
      }

      const suspensionsByContract = new Map<string, DiarySuspension[]>();
      for (const r of suspRes.data ?? []) {
        const s: DiarySuspension = { contractId: r.contract_id, from: r.from_date, to: r.to_date ?? null, reason: r.reason ?? "" };
        const arr = suspensionsByContract.get(s.contractId) ?? [];
        arr.push(s);
        suspensionsByContract.set(s.contractId, arr);
      }

      const ledgerDeltas: Record<string, LedgerEntry[]> = {};
      for (const r of ledgersRes.data ?? []) {
        (ledgerDeltas[r.item_id] ??= []).push({
          id: r.id, date: r.date, payItemNumber: r.pay_item_number ?? "", desc1: r.desc1 ?? "", desc2: r.desc2 ?? "",
          desc3: r.desc3 ?? "", mixDesign: r.mix_design ?? "", batchLotHeat: r.batch_lot_heat ?? "", type: r.type, transactionQty: Number(r.transaction_qty),
        });
      }
      const eoiRowDeltas: Record<string, EOIEntry[]> = {};
      for (const r of eoiEntriesRes.data ?? []) {
        (eoiRowDeltas[r.item_id] ??= []).push({
          id: r.id, ledgerIds: r.ledger_ids ?? [], actualEoi: r.actual_eoi ?? [], actualMoa: r.actual_moa ?? [],
          testId: r.test_id ?? "", approval: r.approval, note: r.note ?? "", hasDocument: !!r.has_document,
        });
      }
      const payItemStatusDeltas: LoadResult["payItemStatusDeltas"] = {};
      for (const r of pimRes.data ?? []) {
        payItemStatusDeltas[`${r.item_id}:${r.pay_item_number}`] = { status: r.status, note: r.note ?? "" };
      }
      const diaryDeltas: LoadResult["diaryDeltas"] = {};
      for (const r of diaryRes.data ?? []) {
        diaryDeltas[`${r.contract_id}:${r.date}`] = {
          contractId: r.contract_id, date: r.date, weather: r.weather, controllingItem: r.controlling_item ?? "",
          contractorWork: r.contractor_work ?? [], projectLog: r.project_log ?? "", signedBy: r.signed_by ?? null, signedAt: r.signed_at ?? null,
        };
      }

      const world: World = {
        contracts,
        items,
        payItemsByContract,
        samples: (samplesRes.data ?? []).map(rowToSample),
        tests: (testsRes.data ?? []).map(rowToTest),
        testTemplates: TEST_TEMPLATES,
        suspensionsByContract,
        placements: (placementsRes.data ?? []).map(rowToPlacement),
        payEstimates: (estimatesRes.data ?? []).map(rowToPayEstimate),
        authorizations: (authsRes.data ?? []).map(rowToAuthorization),
        mixDesigns: (mixRes.data ?? []).map(rowToMixDesign),
        materialAllowances: [],
        qmpPackages: [],
      };
      return {
        world,
        eoiDeltas,
        ledgerDeltas,
        eoiRowDeltas,
        payItemStatusDeltas,
        diaryDeltas,
        placementDeltas: {},
        payItemDeltas: {},
        payEstimateDeltas: {},
        authorizationDeltas: {},
      };
    },

    async persistInventoryStatus(updates: InventoryStatusUpdate[]): Promise<void> {
      const rows = updates.map((u) => ({
        id: u.id,
        status: u.status,
        ready_at: u.readyAt ? new Date(u.readyAt).toISOString() : null,
      }));
      const { error } = await db.from("inventory_items").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    },

    async persistInventoryNote(id: string, note: string): Promise<void> {
      const { error } = await db.from("inventory_items").update({ note }).eq("id", id);
      if (error) throw error;
    },

    async persistInventoryActive(id: string, active: boolean): Promise<void> {
      const { error } = await db.from("inventory_items").update({ active }).eq("id", id);
      if (error) throw error;
    },

    async persistEoiApproval(
      itemId: string,
      eoiId: string,
      approval: EOIApproval,
      note: string,
    ): Promise<void> {
      const { error } = await db
        .from("eoi_reviews")
        .upsert({ item_id: itemId, eoi_id: eoiId, approval, note }, { onConflict: "item_id,eoi_id" });
      if (error) throw error;
    },

    async persistSample(sample: Sample): Promise<void> {
      const { error } = await db.from("samples").upsert(sampleToRow(sample), { onConflict: "id" });
      if (error) throw error;
    },

    async persistTest(test: Test): Promise<void> {
      const { error } = await db.from("tests").upsert(testToRow(test), { onConflict: "id" });
      if (error) throw error;
    },

    async persistInventoryItem(item: InventoryItem): Promise<void> {
      const { error } = await db.from("inventory_items").upsert(itemToRow(item), { onConflict: "id" });
      if (error) throw error;
    },

    async persistLedger(itemId: string, rows: LedgerEntry[]): Promise<void> {
      // replace-by-item semantics
      const del = await db.from("quantity_ledgers").delete().eq("item_id", itemId);
      if (del.error) throw del.error;
      if (rows.length) {
        const { error } = await db
          .from("quantity_ledgers")
          .insert(rows.map((r) => ({ ...r, item_id: itemId })));
        if (error) throw error;
      }
    },

    async persistEoi(itemId: string, rows: EOIEntry[]): Promise<void> {
      const del = await db.from("eoi_entries").delete().eq("item_id", itemId);
      if (del.error) throw del.error;
      if (rows.length) {
        const { error } = await db.from("eoi_entries").insert(
          rows.map((r) => ({
            id: r.id,
            item_id: itemId,
            ledger_ids: r.ledgerIds,
            actual_eoi: r.actualEoi,
            actual_moa: r.actualMoa,
            test_id: r.testId,
            approval: r.approval,
            note: r.note,
            has_document: r.hasDocument,
          })),
        );
        if (error) throw error;
      }
    },

    async persistPayItemMaterialStatus(
      itemId: string,
      payItemNumber: string,
      status: PayItemMaterialStatus,
      note: string,
    ): Promise<void> {
      const { error } = await db
        .from("pay_item_materials")
        .upsert(
          { item_id: itemId, pay_item_number: payItemNumber, status, note },
          { onConflict: "item_id,pay_item_number" },
        );
      if (error) throw error;
    },

    async persistDiaryDay(day: DiaryDay): Promise<void> {
      const { error } = await db.from("diary_days").upsert(
        {
          contract_id: day.contractId,
          date: day.date,
          weather: day.weather,
          controlling_item: day.controllingItem,
          contractor_work: day.contractorWork,
          project_log: day.projectLog,
          signed_by: day.signedBy,
          signed_at: day.signedAt,
        },
        { onConflict: "contract_id,date" },
      );
      if (error) throw error;
    },

    async persistSuspension(s: DiarySuspension): Promise<void> {
      const { error } = await db
        .from("diary_suspensions")
        .insert({ contract_id: s.contractId, from_date: s.from, to_date: s.to, reason: s.reason });
      if (error) throw error;
    },

    async persistPlacement(p: PlacementEntry): Promise<void> {
      const { error } = await db.from("placements").upsert(
        {
          id: p.id,
          pay_item_number: p.payItemNumber,
          contract_id: p.contractId,
          date: p.date,
          fund_key: p.fundKey,
          type: p.type,
          quantity: p.quantity,
          price: p.price,
          location: p.location,
          contractor: p.contractor,
          posted: p.posted,
          pay_estimate_id: p.payEstimateId,
          creator: p.creator,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },

    async persistPayItem(contractId: string, p: PayItem): Promise<void> {
      const { error } = await db.from("pay_items").upsert(
        {
          contract_id: contractId,
          number: p.number,
          description: p.description,
          unit: p.unit,
          unit_price: p.unitPrice,
          awarded_quantity: p.awardedQuantity,
          placed_quantity: p.placedQuantity,
          fund_key: p.fundKey ?? null,
          final: p.final ?? false,
        },
        { onConflict: "contract_id,number" },
      );
      if (error) throw error;
    },

    async persistPayEstimate(e: PayEstimate): Promise<void> {
      const { error } = await db.from("pay_estimates").upsert(
        {
          id: e.id,
          contract_id: e.contractId,
          number: e.number,
          period_start: e.periodStart,
          period_end: e.periodEnd,
          status: e.status,
          submitted_by: e.submittedBy,
          submitted_at: e.submittedAt,
          lines: e.lines,
          this_estimate_total: e.thisEstimateTotal,
          to_date_total: e.toDateTotal,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },

    async persistAuthorization(a: Authorization): Promise<void> {
      const { error } = await db.from("authorizations").upsert(
        {
          id: a.id,
          contract_id: a.contractId,
          number: a.number,
          type: a.type,
          description: a.description,
          net_change: a.netChange,
          status: a.status,
          created_date: a.createdDate,
          items: a.items,
          approvals: a.approvals,
          has_attachment: a.hasAttachment,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },

    async persistContractSummary(contractId: string, patch: Partial<ContractSummary>): Promise<void> {
      // Read-modify-write the jsonb summary column.
      const { data, error: readErr } = await db.from("contracts").select("summary").eq("id", contractId).single();
      if (readErr) throw readErr;
      const summary = { ...((data?.summary as ContractSummary) ?? {}), ...patch };
      const { error } = await db.from("contracts").update({ summary }).eq("id", contractId);
      if (error) throw error;
    },

    async persistFinalReview(contractId: string, finalReview: FinalReview): Promise<void> {
      const { error } = await db.from("contracts").update({ final_review: finalReview }).eq("id", contractId);
      if (error) throw error;
    },

    async persistContract(contract: Contract): Promise<void> {
      const { error } = await db.from("contracts").upsert(
        {
          id: contract.id,
          number: contract.number,
          name: contract.name,
          county: contract.county,
          district: contract.district,
          work_type: contract.workType,
          summary: contract.summary,
          insurance: contract.insurance,
          subcontractors: contract.subcontractors,
          project_documents: contract.projectDocuments,
          final_review: contract.finalReview,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },

    async persistMaterialAllowance(contractId: string, lines: MaterialAllowanceLine[]): Promise<void> {
      const del = await db.from("material_allowances").delete().eq("contract_id", contractId);
      if (del.error) throw del.error;
      if (lines.length) {
        const { error } = await db.from("material_allowances").insert(lines.map((l) => ({ ...l, contract_id: contractId })));
        if (error) throw error;
      }
    },

    async persistQmpPackage(pkg: QmpPackage): Promise<void> {
      const { error } = await db.from("qmp_packages").upsert(pkg, { onConflict: "id" });
      if (error) throw error;
    },
  };
}

function itemToRow(i: InventoryItem): Record<string, unknown> {
  return {
    id: i.id,
    inventory_id: i.inventoryId,
    contract_id: i.contractId,
    contract_number: i.contractNumber,
    material_code: i.materialCode,
    material_name: i.materialName,
    material_unit: i.materialUnit,
    producer_number: i.producerNumber,
    producer_name: i.producerName,
    supplier_number: i.supplierNumber,
    supplier_name: i.supplierName,
    status: i.status,
    note: i.note,
    pay_item_numbers: i.payItemNumbers,
    ready_at: i.readyAt ? new Date(i.readyAt).toISOString() : null,
  };
}

function sampleToRow(s: Sample): Record<string, unknown> {
  return {
    id: s.id,
    sample_identifier: s.sampleIdentifier,
    test_id: s.testId,
    inspection_type: s.inspectionType,
    inspector: s.inspector,
    sample_date: s.sampleDate,
    total_samples: s.totalSamples,
    material_code: s.materialCode,
    material_name: s.materialName,
    desc1: s.desc1,
    desc2: s.desc2,
    desc3: s.desc3,
    special_id: s.specialId,
    inspected_qty: s.inspectedQty,
    material_unit: s.materialUnit,
    producer_number: s.producerNumber,
    producer_name: s.producerName,
    supplier_number: s.supplierNumber,
    supplier_name: s.supplierName,
    sampled_from: s.sampledFrom,
    latitude: s.latitude,
    longitude: s.longitude,
    spec_year: s.specYear,
    dsa_baba: s.dsaBaba,
    responsible_lab: s.responsibleLab,
    contract_id: s.contractId,
    pay_item_number: s.payItemNumber,
    inventory_item_id: s.inventoryItemId,
    received_date: s.receivedDate,
    started_date: s.startedDate,
    completed_date: s.completedDate,
    status: s.status,
    approver_name: s.approverName,
    approved_date: s.approvedDate,
    note: s.note,
    has_document: s.hasDocument,
  };
}

function testToRow(t: Test): Record<string, unknown> {
  return {
    id: t.id,
    sample_id: t.sampleId,
    series: t.series,
    test_type: t.testType,
    tested_by: t.testedBy,
    test_date: t.testDate,
    fields: t.fields,
    validated: t.validated,
    validated_by: t.validatedBy,
    validated_at: t.validatedAt,
  };
}

// --- row ↔ domain mapping --------------------------------------------------

function rowToContract(r: Record<string, unknown>): Contract {
  return {
    id: r.id as string,
    number: r.number as string,
    name: r.name as string,
    county: r.county as string,
    district: r.district as number,
    workType: r.work_type as string,
    inventoryCount: (r.inventory_count as number) ?? 0,
    readyForReviewCount: (r.ready_for_review_count as number) ?? 0,
    summary: (r.summary as ContractSummary) ?? ({} as ContractSummary),
    // sub-tab data lives in jsonb columns once brief 12 adds them; default empty.
    insurance:
      (r.insurance as Contract["insurance"]) ??
      ({
        contractorNo: "",
        primeContractorName: "",
        itemNo: "",
        finalAcceptanceDate: null,
        pctComplete: 0,
        pctCompleteDate: null,
        policies: [],
        railroad: [],
      } as Contract["insurance"]),
    subcontractors: (r.subcontractors as Contract["subcontractors"]) ?? [],
    projectDocuments: (r.project_documents as Contract["projectDocuments"]) ?? [],
    finalReview:
      (r.final_review as Contract["finalReview"]) ??
      ({
        finalFromDistrict: {} as Contract["finalReview"]["finalFromDistrict"],
        documentationReview: {} as Contract["finalReview"]["documentationReview"],
        materialsReview: {} as Contract["finalReview"]["materialsReview"],
        performancePeriod: [],
        dbeCloseOut: {} as Contract["finalReview"]["dbeCloseOut"],
      } as Contract["finalReview"]),
  };
}

function rowToPayItem(r: Record<string, unknown>): PayItem {
  return {
    number: r.number as string,
    description: r.description as string,
    unit: r.unit as string,
    unitPrice: r.unit_price as number,
    awardedQuantity: r.awarded_quantity as number,
    placedQuantity: r.placed_quantity as number,
  };
}

type Row = Record<string, unknown>;
const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const sOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => Number(v ?? 0);

function rowToSample(r: Row): Sample {
  return {
    id: str(r.id), sampleIdentifier: str(r.sample_identifier), testId: str(r.test_id), inspectionType: str(r.inspection_type),
    inspector: str(r.inspector), sampleDate: str(r.sample_date), totalSamples: num(r.total_samples),
    materialCode: str(r.material_code), materialName: str(r.material_name), desc1: str(r.desc1), desc2: str(r.desc2),
    desc3: str(r.desc3), specialId: str(r.special_id), inspectedQty: num(r.inspected_qty), materialUnit: str(r.material_unit),
    producerNumber: str(r.producer_number), producerName: str(r.producer_name), supplierNumber: str(r.supplier_number), supplierName: str(r.supplier_name),
    sampledFrom: str(r.sampled_from), latitude: str(r.latitude), longitude: str(r.longitude), specYear: str(r.spec_year),
    dsaBaba: !!r.dsa_baba, responsibleLab: str(r.responsible_lab), contractId: sOrNull(r.contract_id), payItemNumber: sOrNull(r.pay_item_number),
    inventoryItemId: sOrNull(r.inventory_item_id), receivedDate: sOrNull(r.received_date), startedDate: sOrNull(r.started_date),
    completedDate: sOrNull(r.completed_date), status: r.status as Sample["status"], approverName: str(r.approver_name), approvedDate: sOrNull(r.approved_date),
    note: str(r.note), hasDocument: !!r.has_document,
  };
}
function rowToTest(r: Row): Test {
  return {
    id: str(r.id), sampleId: str(r.sample_id), series: num(r.series), testType: str(r.test_type), testedBy: str(r.tested_by),
    testDate: sOrNull(r.test_date), fields: (r.fields as Test["fields"]) ?? [], validated: !!r.validated, validatedBy: str(r.validated_by), validatedAt: sOrNull(r.validated_at),
  };
}
function rowToPlacement(r: Row): PlacementEntry {
  return {
    id: str(r.id), payItemNumber: str(r.pay_item_number), contractId: str(r.contract_id), date: str(r.date), fundKey: str(r.fund_key),
    type: r.type as PlacementEntry["type"], quantity: num(r.quantity), price: num(r.price), location: str(r.location), contractor: str(r.contractor),
    posted: !!r.posted, payEstimateId: sOrNull(r.pay_estimate_id), creator: str(r.creator),
  };
}
function rowToPayEstimate(r: Row): PayEstimate {
  return {
    id: str(r.id), contractId: str(r.contract_id), number: num(r.number), periodStart: str(r.period_start), periodEnd: str(r.period_end),
    status: r.status as PayEstimate["status"], submittedBy: sOrNull(r.submitted_by), submittedAt: sOrNull(r.submitted_at), lines: (r.lines as PayEstimate["lines"]) ?? [],
    thisEstimateTotal: num(r.this_estimate_total), toDateTotal: num(r.to_date_total),
  };
}
function rowToAuthorization(r: Row): Authorization {
  return {
    id: str(r.id), contractId: str(r.contract_id), number: num(r.number), type: r.type as Authorization["type"], description: str(r.description),
    netChange: num(r.net_change), status: r.status as Authorization["status"], createdDate: str(r.created_date), items: (r.items as Authorization["items"]) ?? [],
    approvals: (r.approvals as Authorization["approvals"]) ?? [], hasAttachment: !!r.has_attachment,
  };
}
function rowToMixDesign(r: Row): MixDesign {
  return { number: str(r.number), materialCode: str(r.material_code), family: (str(r.family, "Other")) as MaterialFamily, producer: str(r.producer), approved: !!r.approved, docUrl: r.doc_url ? str(r.doc_url) : undefined };
}

function rowToItem(r: Record<string, unknown>): InventoryItem {
  return {
    id: r.id as string,
    inventoryId: r.inventory_id as string,
    contractId: r.contract_id as string,
    contractNumber: r.contract_number as string,
    materialCode: r.material_code as string,
    materialName: r.material_name as string,
    materialUnit: r.material_unit as string,
    producerNumber: r.producer_number as string,
    producerName: r.producer_name as string,
    supplierNumber: r.supplier_number as string,
    supplierName: r.supplier_name as string,
    status: r.status as InventoryItem["status"],
    note: (r.note as string) ?? "",
    payItemNumbers: (r.pay_item_numbers as string[]) ?? [],
    readyAt: r.ready_at ? new Date(r.ready_at as string).getTime() : null,
  };
}
