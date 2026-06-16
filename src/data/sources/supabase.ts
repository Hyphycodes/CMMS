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
} from "@/domain/types";
import type { SeedConfig, World } from "../seed/generate";

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

    async loadWorld(_config: SeedConfig): Promise<LoadResult> {
      const [contractsRes, payItemsRes, itemsRes, reviewsRes] = await Promise.all([
        db.from("contracts").select("*"),
        db.from("pay_items").select("*"),
        db.from("inventory_items").select("*"),
        db.from("eoi_reviews").select("*"),
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

      const world: World = { contracts, items, payItemsByContract };
      return { world, eoiDeltas };
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
