/**
 * In-browser data source. Generates the deterministic world, applies deltas
 * persisted in localStorage, and saves future deltas there. Saves run with a
 * small simulated latency so the optimistic UI is genuinely asynchronous. A
 * dev-only "chaos" probability can force failures to demonstrate rollback.
 */
import type {
  DataSource,
  LoadResult,
  InventoryStatusUpdate,
  EoiDelta,
} from "../dataSource";
import type { EOIApproval, InventoryStatus } from "@/domain/types";
import { generateWorld, type SeedConfig } from "../seed/generate";

const STORAGE_KEY = "proof:deltas:v1";

interface StoredDeltas {
  inventoryStatus: Record<string, { status: InventoryStatus; readyAt: number | null }>;
  inventoryNote: Record<string, string>;
  eoiApproval: Record<string, EoiDelta>;
}

function emptyDeltas(): StoredDeltas {
  return { inventoryStatus: {}, inventoryNote: {}, eoiApproval: {} };
}

function readDeltas(): StoredDeltas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDeltas();
    return { ...emptyDeltas(), ...(JSON.parse(raw) as StoredDeltas) };
  } catch {
    return emptyDeltas();
  }
}

function writeDeltas(d: StoredDeltas): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* storage full / unavailable — non-fatal, optimistic state still holds */
  }
}

const latency = () => new Promise<void>((r) => setTimeout(r, 280 + Math.random() * 360));

let chaos = 0; // probability a save fails, for demonstrating rollback
export function setChaos(p: number): void {
  chaos = p;
}
function maybeFail(): void {
  if (chaos > 0 && Math.random() < chaos) {
    throw new Error("Simulated save failure (chaos mode)");
  }
}

export function createLocalDataSource(): DataSource {
  return {
    name: "local",

    async loadWorld(config: SeedConfig): Promise<LoadResult> {
      const world = generateWorld(config);
      const deltas = readDeltas();

      // Apply persisted inventory status + note deltas onto the seed.
      for (const item of world.items) {
        const s = deltas.inventoryStatus[item.id];
        if (s) {
          item.status = s.status;
          item.readyAt = s.readyAt;
        }
        const n = deltas.inventoryNote[item.id];
        if (n !== undefined) item.note = n;
      }
      // Recompute denormalized counts after applying deltas.
      const ready = new Map<string, number>();
      for (const it of world.items) {
        if (it.status === "Ready for Review") {
          ready.set(it.contractId, (ready.get(it.contractId) ?? 0) + 1);
        }
      }
      for (const c of world.contracts) c.readyForReviewCount = ready.get(c.id) ?? 0;

      return { world, eoiDeltas: deltas.eoiApproval };
    },

    async persistInventoryStatus(updates: InventoryStatusUpdate[]): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      for (const u of updates) {
        d.inventoryStatus[u.id] = { status: u.status, readyAt: u.readyAt };
      }
      writeDeltas(d);
    },

    async persistInventoryNote(id: string, note: string): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.inventoryNote[id] = note;
      writeDeltas(d);
    },

    async persistEoiApproval(
      itemId: string,
      eoiId: string,
      approval: EOIApproval,
      note: string,
    ): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.eoiApproval[`${itemId}:${eoiId}`] = { approval, note };
      writeDeltas(d);
    },
  };
}
