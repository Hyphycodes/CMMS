/**
 * In-browser data source. Generates the deterministic world, then replays the
 * durable delta log (F1) to reach current state, and appends new writes to that
 * log. Saves run with a small simulated latency so the optimistic UI is genuinely
 * asynchronous. A dev-only "chaos" probability can force failures to demo rollback.
 *
 * The log (`deltaLog.ts`, IndexedDB) is the source of truth. The legacy
 * `proof:deltas:v1` localStorage blob is kept as a materialized cache and as the
 * migration seed on first load — `loadWorld` replays the log over it every time.
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
  PlacementEntry,
  PayItem,
  PayEstimate,
  Authorization,
  Contract,
  ContractSummary,
  FinalReview,
  MaterialAllowanceLine,
  QmpPackage,
  StoredFileRef,
} from "@/domain/types";
import type { FileScope } from "../dataSource";
import { generateWorld, type SeedConfig } from "../seed/generate";
import * as deltaLog from "../deltaLog";
import type { DeltaOp, DeltaEntity } from "../deltaLog";

const STORAGE_KEY = "proof:deltas:v1";

interface StoredDeltas {
  inventoryStatus: Record<string, { status: InventoryStatus; readyAt: number | null }>;
  inventoryNote: Record<string, string>;
  inventoryActive: Record<string, boolean>;
  eoiApproval: Record<string, EoiDelta>;
  samples: Record<string, Sample>;
  tests: Record<string, Test>;
  inventoryItems: Record<string, InventoryItem>;
  ledgers: Record<string, LedgerEntry[]>;
  eois: Record<string, EOIEntry[]>;
  payItemStatus: Record<string, PayItemMaterialStatusDelta>;
  diaryDays: Record<string, DiaryDay>;
  suspensions: Record<string, DiarySuspension[]>;
  placements: Record<string, PlacementEntry>;
  payItems: Record<string, PayItem>;
  payEstimates: Record<string, PayEstimate>;
  authorizations: Record<string, Authorization>;
  contractSummaries: Record<string, Partial<ContractSummary>>;
  finalReviews: Record<string, FinalReview>;
  contracts: Record<string, Contract>;
  materialAllowances: Record<string, MaterialAllowanceLine[]>;
  qmpPackages: Record<string, QmpPackage>;
  fileRefs: Record<string, StoredFileRef[]>;
}

function emptyDeltas(): StoredDeltas {
  return {
    inventoryStatus: {},
    inventoryNote: {},
    inventoryActive: {},
    eoiApproval: {},
    samples: {},
    tests: {},
    inventoryItems: {},
    ledgers: {},
    eois: {},
    payItemStatus: {},
    diaryDays: {},
    suspensions: {},
    placements: {},
    payItems: {},
    payEstimates: {},
    authorizations: {},
    contractSummaries: {},
    finalReviews: {},
    contracts: {},
    materialAllowances: {},
    qmpPackages: {},
    fileRefs: {},
  };
}

function writeCache(d: StoredDeltas): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* storage full / unavailable — non-fatal, the log remains the source of truth */
  }
}

function readLegacyBlob(): StoredDeltas | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...emptyDeltas(), ...(JSON.parse(raw) as StoredDeltas) };
  } catch {
    return null;
  }
}

const latency = () => new Promise<void>((r) => setTimeout(r, 280 + Math.random() * 360));

let chaos = 0; // probability a save fails, for demonstrating rollback
export function setChaos(p: number): void {
  chaos = p;
}
// Dev affordance: `?chaos=0.5` forces ~50% of saves to fail so optimistic
// rollback + the error toast are demonstrable (brief 13).
try {
  const c = Number(new URLSearchParams(window.location.search).get("chaos"));
  if (!Number.isNaN(c) && c > 0) chaos = Math.min(1, c);
} catch {
  /* non-browser (seed script) — ignore */
}
function maybeFail(): void {
  if (chaos > 0 && Math.random() < chaos) {
    throw new Error("Simulated save failure (chaos mode)");
  }
}

// --- op id + log helpers ---------------------------------------------------

function opId(entity: DeltaEntity, entityId: string): string {
  return `${entity}:${entityId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

/** Pure, deterministic replay of the ordered op log → materialized deltas. */
export function replay(ops: DeltaOp[]): StoredDeltas {
  const d = emptyDeltas();
  for (const op of ops) {
    const p = op.payload;
    switch (op.entity) {
      case "inventoryStatus":
        d.inventoryStatus[op.entityId] = p as StoredDeltas["inventoryStatus"][string];
        break;
      case "inventoryNote":
        d.inventoryNote[op.entityId] = p as string;
        break;
      case "inventoryActive":
        d.inventoryActive[op.entityId] = p as boolean;
        break;
      case "eoiApproval":
        d.eoiApproval[op.entityId] = p as EoiDelta;
        break;
      case "sample":
        d.samples[op.entityId] = p as Sample;
        break;
      case "test":
        d.tests[op.entityId] = p as Test;
        break;
      case "inventoryItem":
        d.inventoryItems[op.entityId] = p as InventoryItem;
        break;
      case "ledger":
        d.ledgers[op.entityId] = p as LedgerEntry[];
        break;
      case "eoi":
        d.eois[op.entityId] = p as EOIEntry[];
        break;
      case "payItemStatus":
        d.payItemStatus[op.entityId] = p as PayItemMaterialStatusDelta;
        break;
      case "diaryDay":
        d.diaryDays[op.entityId] = p as DiaryDay;
        break;
      case "suspension":
        (d.suspensions[op.entityId] ??= []).push(p as DiarySuspension);
        break;
      case "placement":
        d.placements[op.entityId] = p as PlacementEntry;
        break;
      case "payItem":
        d.payItems[op.entityId] = p as PayItem;
        break;
      case "payEstimate":
        d.payEstimates[op.entityId] = p as PayEstimate;
        break;
      case "authorization":
        d.authorizations[op.entityId] = p as Authorization;
        break;
      case "contractSummary":
        d.contractSummaries[op.entityId] = {
          ...(d.contractSummaries[op.entityId] ?? {}),
          ...(p as Partial<ContractSummary>),
        };
        break;
      case "finalReview":
        d.finalReviews[op.entityId] = p as FinalReview;
        break;
      case "contract":
        d.contracts[op.entityId] = p as Contract;
        break;
      case "materialAllowance":
        d.materialAllowances[op.entityId] = p as MaterialAllowanceLine[];
        break;
      case "qmpPackage":
        d.qmpPackages[op.entityId] = p as QmpPackage;
        break;
      case "fileRefs":
        d.fileRefs[op.entityId] = p as StoredFileRef[];
        break;
      case "import":
        break; // import-log rows are surfaced from the log directly, not materialized here
    }
  }
  return d;
}

/** One-time migration of the legacy materialized blob into the op log. */
async function migrateLegacyBlob(): Promise<void> {
  if (deltaLog.all().length > 0) return;
  const blob = readLegacyBlob();
  if (!blob) return;
  const inputs: { id: string; entity: DeltaEntity; entityId: string; payload: unknown }[] = [];
  const add = (entity: DeltaEntity, entityId: string, payload: unknown) =>
    inputs.push({ id: `migrate:${entity}:${entityId}`, entity, entityId, payload });
  for (const [k, v] of Object.entries(blob.inventoryStatus)) add("inventoryStatus", k, v);
  for (const [k, v] of Object.entries(blob.inventoryNote)) add("inventoryNote", k, v);
  for (const [k, v] of Object.entries(blob.eoiApproval)) add("eoiApproval", k, v);
  for (const [k, v] of Object.entries(blob.samples)) add("sample", k, v);
  for (const [k, v] of Object.entries(blob.tests)) add("test", k, v);
  for (const [k, v] of Object.entries(blob.inventoryItems)) add("inventoryItem", k, v);
  for (const [k, v] of Object.entries(blob.ledgers)) add("ledger", k, v);
  for (const [k, v] of Object.entries(blob.eois)) add("eoi", k, v);
  for (const [k, v] of Object.entries(blob.payItemStatus)) add("payItemStatus", k, v);
  for (const [k, v] of Object.entries(blob.diaryDays)) add("diaryDay", k, v);
  for (const [cid, arr] of Object.entries(blob.suspensions))
    arr.forEach((s, i) => inputs.push({ id: `migrate:suspension:${cid}:${i}`, entity: "suspension", entityId: cid, payload: s }));
  for (const [k, v] of Object.entries(blob.placements)) add("placement", k, v);
  for (const [k, v] of Object.entries(blob.payItems)) add("payItem", k, v);
  for (const [k, v] of Object.entries(blob.payEstimates)) add("payEstimate", k, v);
  for (const [k, v] of Object.entries(blob.authorizations)) add("authorization", k, v);
  if (inputs.length) await deltaLog.appendBatch(inputs);
}

export function createLocalDataSource(): DataSource {
  // append a write op, then refresh the materialized cache from the full log
  async function commit(entity: DeltaEntity, entityId: string, payload: unknown, op: "upsert" | "delete" = "upsert"): Promise<void> {
    await deltaLog.append({ id: opId(entity, entityId), entity, entityId, payload, op });
    writeCache(replay(deltaLog.all()));
  }

  return {
    name: "local",

    async loadWorld(config: SeedConfig): Promise<LoadResult> {
      const world = generateWorld(config);
      await deltaLog.init();
      await migrateLegacyBlob();
      const deltas = replay(deltaLog.all());
      writeCache(deltas); // keep the cache coherent with the log

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
        const a = deltas.inventoryActive[item.id];
        if (a !== undefined) item.active = a;
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
      // Overlay contract-level edits (summary patch, final review, whole-contract upserts).
      world.contracts = overlay(world.contracts, deltas.contracts, (c) => c.id);
      for (const c of world.contracts) {
        c.inventoryCount = inv.get(c.id) ?? 0;
        c.readyForReviewCount = ready.get(c.id) ?? 0;
        const sp = deltas.contractSummaries[c.id];
        if (sp) c.summary = { ...c.summary, ...sp };
        const fr = deltas.finalReviews[c.id];
        if (fr) c.finalReview = fr;
      }

      // Overlay sample / test deltas (upserts by id; new rows append).
      world.samples = overlay(world.samples, deltas.samples, (s) => s.id);
      world.tests = overlay(world.tests, deltas.tests, (t) => t.id);

      // Append persisted suspensions onto the seeded ones.
      for (const [contractId, rows] of Object.entries(deltas.suspensions)) {
        const existing = world.suspensionsByContract.get(contractId) ?? [];
        world.suspensionsByContract.set(contractId, [...existing, ...rows]);
      }

      // Overlay placements (upsert by id) and pay item edits (final / authorizations).
      world.placements = overlay(world.placements, deltas.placements, (p) => p.id);
      world.payEstimates = overlay(world.payEstimates, deltas.payEstimates, (e) => e.id);
      world.authorizations = overlay(world.authorizations, deltas.authorizations, (a) => a.id);
      world.materialAllowances = overlay(
        world.materialAllowances,
        flattenAllowances(deltas.materialAllowances),
        (l) => l.id,
      );
      world.qmpPackages = overlay(world.qmpPackages, deltas.qmpPackages, (q) => q.id);
      for (const [key, pi] of Object.entries(deltas.payItems)) {
        const contractId = key.slice(0, key.lastIndexOf(":"));
        const list = world.payItemsByContract.get(contractId);
        if (list) {
          const idx = list.findIndex((p) => p.number === pi.number);
          if (idx >= 0) list[idx] = pi;
          else list.push(pi);
        }
      }

      // Rehydrate file object-URLs from the IndexedDB blob store (S1) — object
      // URLs don't survive reload, so rebuild them from the persisted bytes.
      const fileRefs: Record<string, StoredFileRef[]> = {};
      for (const [scopeKey, refs] of Object.entries(deltas.fileRefs)) {
        const hydrated: StoredFileRef[] = [];
        for (const ref of refs) {
          const row = await deltaLog.getFileBlob(ref.id);
          hydrated.push(row ? { ...ref, url: URL.createObjectURL(row.blob), uploading: false } : ref);
        }
        fileRefs[scopeKey] = hydrated;
      }

      return {
        world,
        eoiDeltas: deltas.eoiApproval,
        ledgerDeltas: deltas.ledgers,
        eoiRowDeltas: deltas.eois,
        payItemStatusDeltas: deltas.payItemStatus,
        diaryDeltas: deltas.diaryDays,
        placementDeltas: deltas.placements,
        payItemDeltas: deltas.payItems,
        payEstimateDeltas: deltas.payEstimates,
        authorizationDeltas: deltas.authorizations,
        fileRefs,
      };
    },

    async uploadFile(scope: FileScope, file: File): Promise<StoredFileRef> {
      await latency();
      maybeFail();
      const id = `file_${scope.entity}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await deltaLog.putFileBlob({ id, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, blob: file });
      return {
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: deltaLog.getActor().userId,
        uploadedAt: new Date().toISOString(),
      };
    },

    async deleteFile(ref: StoredFileRef): Promise<void> {
      await latency();
      maybeFail();
      if (ref.url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(ref.url);
        } catch {
          /* non-fatal */
        }
      }
      await deltaLog.deleteFileBlob(ref.id);
    },

    async persistFileRefs(scopeKey: string, refs: StoredFileRef[]): Promise<void> {
      // strip the ephemeral object-URL + uploading flag from the persisted ref
      const lean = refs.map((r) => ({ ...r, url: "", uploading: false }));
      await commit("fileRefs", scopeKey, lean);
    },

    async flush(): Promise<number> {
      // Local mode has no backend: queued ops are already durable in IndexedDB,
      // so flushing simply marks them synced and clears the pending pill.
      return deltaLog.flush();
    },

    async persistInventoryStatus(updates: InventoryStatusUpdate[]): Promise<void> {
      await latency();
      maybeFail();
      for (const u of updates) await commit("inventoryStatus", u.id, { status: u.status, readyAt: u.readyAt });
    },

    async persistInventoryNote(id: string, note: string): Promise<void> {
      await latency();
      maybeFail();
      await commit("inventoryNote", id, note);
    },

    async persistInventoryActive(id: string, active: boolean): Promise<void> {
      await latency();
      maybeFail();
      await commit("inventoryActive", id, active);
    },

    async persistEoiApproval(itemId: string, eoiId: string, approval: EOIApproval, note: string): Promise<void> {
      await latency();
      maybeFail();
      await commit("eoiApproval", `${itemId}:${eoiId}`, { approval, note });
    },

    async persistSample(sample: Sample): Promise<void> {
      await latency();
      maybeFail();
      await commit("sample", sample.id, sample);
    },

    async persistTest(test: Test): Promise<void> {
      await latency();
      maybeFail();
      await commit("test", test.id, test);
    },

    async persistInventoryItem(item: InventoryItem): Promise<void> {
      await latency();
      maybeFail();
      await commit("inventoryItem", item.id, item);
      await commit("inventoryStatus", item.id, { status: item.status, readyAt: item.readyAt });
      await commit("inventoryNote", item.id, item.note);
    },

    async persistLedger(itemId: string, rows: LedgerEntry[]): Promise<void> {
      await latency();
      maybeFail();
      await commit("ledger", itemId, rows);
    },

    async persistEoi(itemId: string, rows: EOIEntry[]): Promise<void> {
      await latency();
      maybeFail();
      await commit("eoi", itemId, rows);
    },

    async persistPayItemMaterialStatus(itemId: string, payItemNumber: string, status: PayItemMaterialStatus, note: string): Promise<void> {
      await latency();
      maybeFail();
      await commit("payItemStatus", `${itemId}:${payItemNumber}`, { status, note });
    },

    async persistDiaryDay(day: DiaryDay): Promise<void> {
      await latency();
      maybeFail();
      await commit("diaryDay", `${day.contractId}:${day.date}`, day);
    },

    async persistSuspension(suspension: DiarySuspension): Promise<void> {
      await latency();
      maybeFail();
      await commit("suspension", suspension.contractId, suspension);
    },

    async persistPlacement(placement: PlacementEntry): Promise<void> {
      await latency();
      maybeFail();
      await commit("placement", placement.id, placement);
    },

    async persistPayItem(contractId: string, payItem: PayItem): Promise<void> {
      await latency();
      maybeFail();
      await commit("payItem", `${contractId}:${payItem.number}`, payItem);
    },

    async persistPayEstimate(estimate: PayEstimate): Promise<void> {
      await latency();
      maybeFail();
      await commit("payEstimate", estimate.id, estimate);
    },

    async persistAuthorization(authorization: Authorization): Promise<void> {
      await latency();
      maybeFail();
      await commit("authorization", authorization.id, authorization);
    },

    async persistContractSummary(contractId: string, patch: Partial<ContractSummary>): Promise<void> {
      await latency();
      maybeFail();
      await commit("contractSummary", contractId, patch);
    },

    async persistFinalReview(contractId: string, finalReview: FinalReview): Promise<void> {
      await latency();
      maybeFail();
      await commit("finalReview", contractId, finalReview);
    },

    async persistContract(contract: Contract): Promise<void> {
      await latency();
      maybeFail();
      await commit("contract", contract.id, contract);
    },

    async persistMaterialAllowance(contractId: string, lines: MaterialAllowanceLine[]): Promise<void> {
      await latency();
      maybeFail();
      await commit("materialAllowance", contractId, lines);
    },

    async persistQmpPackage(pkg: QmpPackage): Promise<void> {
      await latency();
      maybeFail();
      await commit("qmpPackage", pkg.id, pkg);
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

/** Material allowances persist as a per-contract array; flatten to a row map for overlay. */
function flattenAllowances(byContract: Record<string, MaterialAllowanceLine[]>): Record<string, MaterialAllowanceLine> {
  const out: Record<string, MaterialAllowanceLine> = {};
  for (const lines of Object.values(byContract)) for (const l of lines) out[l.id] = l;
  return out;
}
