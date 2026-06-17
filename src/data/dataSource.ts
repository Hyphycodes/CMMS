/**
 * The `dataSource` seam. The UI talks only to this interface, so a real CMMS
 * export (CSV) or API can be dropped in later without touching the UI.
 *
 * Default implementation is in-browser (`localDataSource`): deterministic seed +
 * deltas persisted to localStorage, zero setup. A Supabase implementation ships
 * ready to wire (set VITE_DATA_SOURCE=supabase).
 *
 * Architecture: load the world ONCE, work in the browser, persist only deltas.
 */
import type {
  InventoryStatus,
  EOIApproval,
  Sample,
  Test,
  LedgerEntry,
  EOIEntry,
  InventoryItem,
  PayItemMaterialStatus,
  DiaryDay,
  DiarySuspension,
  PlacementEntry,
  PayItem,
  PayEstimate,
  Authorization,
} from "@/domain/types";
import type { World, SeedConfig } from "./seed/generate";

export interface EoiDelta {
  approval: EOIApproval;
  note: string;
}

export interface PayItemMaterialStatusDelta {
  status: PayItemMaterialStatus;
  note: string;
}

export interface LoadResult {
  world: World;
  /** keyed by `${itemId}:${eoiId}` */
  eoiDeltas: Record<string, EoiDelta>;
  /** writable Quantity Ledger rows, keyed by itemId (brief 05) */
  ledgerDeltas: Record<string, LedgerEntry[]>;
  /** writable EOI rows, keyed by itemId (brief 05) */
  eoiRowDeltas: Record<string, EOIEntry[]>;
  /** Pay Item Material Status overrides, keyed by `${itemId}:${payItemNumber}` */
  payItemStatusDeltas: Record<string, PayItemMaterialStatusDelta>;
  /** Diary day edits/signs, keyed by `${contractId}:${date}` (brief 07) */
  diaryDeltas: Record<string, DiaryDay>;
  /** Placement edits, keyed by placement id (brief 08) */
  placementDeltas: Record<string, PlacementEntry>;
  /** Pay item edits (final flag, authorization propagation), keyed `${contractId}:${number}` */
  payItemDeltas: Record<string, PayItem>;
  /** Pay estimate create/submit, keyed by estimate id (brief 09) */
  payEstimateDeltas: Record<string, PayEstimate>;
  /** Authorization create/approve/publish, keyed by authorization id (brief 10) */
  authorizationDeltas: Record<string, Authorization>;
}

export interface InventoryStatusUpdate {
  id: string;
  status: InventoryStatus;
  readyAt: number | null;
}

export interface DataSource {
  readonly name: string;
  /** Load the full world (seed + any persisted deltas already applied). */
  loadWorld(config: SeedConfig): Promise<LoadResult>;
  /** Persist a batch of inventory status changes (deltas only). */
  persistInventoryStatus(updates: InventoryStatusUpdate[]): Promise<void>;
  persistInventoryNote(id: string, note: string): Promise<void>;
  persistEoiApproval(
    itemId: string,
    eoiId: string,
    approval: EOIApproval,
    note: string,
  ): Promise<void>;

  // Samples + tests (briefs 03–04). Status/approval/validation are field updates
  // on the upserted object, so the seam stays two parallel upserts.
  persistSample(sample: Sample): Promise<void>;
  persistTest(test: Test): Promise<void>;

  // Inventory writes (brief 05).
  persistInventoryItem(item: InventoryItem): Promise<void>;
  persistLedger(itemId: string, rows: LedgerEntry[]): Promise<void>;
  persistEoi(itemId: string, rows: EOIEntry[]): Promise<void>;
  persistPayItemMaterialStatus(
    itemId: string,
    payItemNumber: string,
    status: PayItemMaterialStatus,
    note: string,
  ): Promise<void>;

  // Diary (brief 07).
  persistDiaryDay(day: DiaryDay): Promise<void>;
  persistSuspension(suspension: DiarySuspension): Promise<void>;

  // Quantity Book + Authorizations (briefs 08 + 10).
  persistPlacement(placement: PlacementEntry): Promise<void>;
  persistPayItem(contractId: string, payItem: PayItem): Promise<void>;

  // Pay Estimate (brief 09).
  persistPayEstimate(estimate: PayEstimate): Promise<void>;

  // Authorizations (brief 10).
  persistAuthorization(authorization: Authorization): Promise<void>;
}

let cached: DataSource | null = null;

/** Pick the data source from env. Defaults to local so the app runs with zero setup. */
export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  const mode = import.meta.env.VITE_DATA_SOURCE ?? "local";
  if (mode === "supabase") {
    const { createSupabaseDataSource } = await import("./sources/supabase");
    cached = createSupabaseDataSource();
  } else {
    const { createLocalDataSource } = await import("./sources/local");
    cached = createLocalDataSource();
  }
  return cached;
}
