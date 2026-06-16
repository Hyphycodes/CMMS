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
import type { InventoryStatus, EOIApproval } from "@/domain/types";
import type { World, SeedConfig } from "./seed/generate";

export interface EoiDelta {
  approval: EOIApproval;
  note: string;
}

export interface LoadResult {
  world: World;
  /** keyed by `${itemId}:${eoiId}` */
  eoiDeltas: Record<string, EoiDelta>;
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
