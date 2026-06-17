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
  PayItemMaterialStatusDelta,
} from "../dataSource";
import type {
  EOIApproval,
  InventoryStatus,
  Sample,
  Test,
  LedgerEntry,
  EOIEntry,
  InventoryItem,
  PayItemMaterialStatus,
  DiaryDay,
  DiarySuspension,
} from "@/domain/types";
import { generateWorld, type SeedConfig } from "../seed/generate";

const STORAGE_KEY = "proof:deltas:v1";

interface StoredDeltas {
  inventoryStatus: Record<string, { status: InventoryStatus; readyAt: number | null }>;
  inventoryNote: Record<string, string>;
  eoiApproval: Record<string, EoiDelta>;
  samples: Record<string, Sample>;
  tests: Record<string, Test>;
  inventoryItems: Record<string, InventoryItem>;
  ledgers: Record<string, LedgerEntry[]>;
  eois: Record<string, EOIEntry[]>;
  payItemStatus: Record<string, PayItemMaterialStatusDelta>;
  diaryDays: Record<string, DiaryDay>;
  suspensions: Record<string, DiarySuspension[]>;
}

function emptyDeltas(): StoredDeltas {
  return {
    inventoryStatus: {},
    inventoryNote: {},
    eoiApproval: {},
    samples: {},
    tests: {},
    inventoryItems: {},
    ledgers: {},
    eois: {},
    payItemStatus: {},
    diaryDays: {},
    suspensions: {},
  };
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

      // Overlay created / edited inventory items (brief 05), then status + note.
      world.items = overlay(world.items, deltas.inventoryItems, (i) => i.id);
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
      const inv = new Map<string, number>();
      const ready = new Map<string, number>();
      for (const it of world.items) {
        inv.set(it.contractId, (inv.get(it.contractId) ?? 0) + 1);
        if (it.status === "Ready for Review") {
          ready.set(it.contractId, (ready.get(it.contractId) ?? 0) + 1);
        }
      }
      for (const c of world.contracts) {
        c.inventoryCount = inv.get(c.id) ?? 0;
        c.readyForReviewCount = ready.get(c.id) ?? 0;
      }

      // Overlay sample / test deltas (upserts by id; new rows append).
      world.samples = overlay(world.samples, deltas.samples, (s) => s.id);
      world.tests = overlay(world.tests, deltas.tests, (t) => t.id);

      // Append persisted suspensions onto the seeded ones.
      for (const [contractId, rows] of Object.entries(deltas.suspensions)) {
        const existing = world.suspensionsByContract.get(contractId) ?? [];
        world.suspensionsByContract.set(contractId, [...existing, ...rows]);
      }

      return {
        world,
        eoiDeltas: deltas.eoiApproval,
        ledgerDeltas: deltas.ledgers,
        eoiRowDeltas: deltas.eois,
        payItemStatusDeltas: deltas.payItemStatus,
        diaryDeltas: deltas.diaryDays,
      };
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

    async persistSample(sample: Sample): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.samples[sample.id] = sample;
      writeDeltas(d);
    },

    async persistTest(test: Test): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.tests[test.id] = test;
      writeDeltas(d);
    },

    async persistInventoryItem(item: InventoryItem): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.inventoryItems[item.id] = item;
      // keep status/note column deltas coherent for created/edited items
      d.inventoryStatus[item.id] = { status: item.status, readyAt: item.readyAt };
      d.inventoryNote[item.id] = item.note;
      writeDeltas(d);
    },

    async persistLedger(itemId: string, rows: LedgerEntry[]): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.ledgers[itemId] = rows;
      writeDeltas(d);
    },

    async persistEoi(itemId: string, rows: EOIEntry[]): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.eois[itemId] = rows;
      writeDeltas(d);
    },

    async persistPayItemMaterialStatus(
      itemId: string,
      payItemNumber: string,
      status: PayItemMaterialStatus,
      note: string,
    ): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.payItemStatus[`${itemId}:${payItemNumber}`] = { status, note };
      writeDeltas(d);
    },

    async persistDiaryDay(day: DiaryDay): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      d.diaryDays[`${day.contractId}:${day.date}`] = day;
      writeDeltas(d);
    },

    async persistSuspension(suspension: DiarySuspension): Promise<void> {
      await latency();
      maybeFail();
      const d = readDeltas();
      const arr = d.suspensions[suspension.contractId] ?? [];
      arr.push(suspension);
      d.suspensions[suspension.contractId] = arr;
      writeDeltas(d);
    },
  };
}

/** Upsert delta records onto a seed list by id (new rows append). */
function overlay<T>(base: T[], deltas: Record<string, T>, key: (t: T) => string): T[] {
  if (Object.keys(deltas).length === 0) return base;
  const out = base.slice();
  const index = new Map(out.map((row, i) => [key(row), i]));
  for (const row of Object.values(deltas)) {
    const k = key(row);
    const i = index.get(k);
    if (i !== undefined) out[i] = row;
    else {
      index.set(k, out.length);
      out.push(row);
    }
  }
  return out;
}
