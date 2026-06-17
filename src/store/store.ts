/**
 * The in-memory working set. The world is loaded ONCE; all reads are synchronous
 * selectors over memory. Mutations apply optimistically (UI flips instantly), then
 * persist in the background and silently roll back + toast on failure.
 */
import { create } from "zustand";
import type {
  Contract,
  InventoryItem,
  InventoryDetail,
  PayItem,
  InventoryStatus,
  EOIApproval,
  ReviewQueueItem,
  User,
  Sample,
  Test,
  TestTemplate,
} from "@/domain/types";
import { getDataSource } from "@/data/dataSource";
import { DEFAULT_SEED_CONFIG, buildDetail } from "@/data/seed/generate";
import type { EoiDelta } from "@/data/dataSource";
import { buildDemoUsers, DEFAULT_USER_ID } from "@/auth/demoUsers";
import { can as canDo, visibleContractIds, type Capability } from "@/auth/permissions";

const USER_KEY = "proof:user:v1";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface State {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  dataSourceName: string;

  contracts: Contract[];
  contractsById: Map<string, Contract>;
  items: InventoryItem[];
  payItemsByContract: Map<string, PayItem[]>;
  eoiDeltas: Record<string, EoiDelta>;

  // samples + tests (briefs 03–04)
  samplesList: Sample[];
  testsList: Test[];
  testTemplates: TestTemplate[];

  // users / roles / scope (brief 02)
  users: User[];
  currentUser: User | undefined;
  visibleIds: Set<string>;
  setCurrentUser(id: string): void;
  can(cap: Capability): boolean;
  canAccessContract(contractId: string): boolean;

  savingCount: number;
  toasts: Toast[];

  load(): Promise<void>;

  // selectors (call inside useMemo for derived structures)
  contract(id: string): Contract | undefined;
  visibleContracts(): Contract[];
  inventoryForContract(contractId: string): InventoryItem[];
  payItemsFor(contractId: string): PayItem[];
  reviewQueue(): ReviewQueueItem[];
  detail(itemId: string): InventoryDetail | undefined;
  samples(): Sample[];
  sample(id: string): Sample | undefined;
  testsForSample(sampleId: string): Test[];

  // mutations (optimistic)
  setInventoryStatus(ids: string[], status: InventoryStatus, opts?: { note?: string }): void;
  setInventoryNote(id: string, note: string): void;
  setEoiApproval(itemId: string, eoiId: string, approval: EOIApproval, note?: string): void;

  pushToast(kind: Toast["kind"], message: string): void;
  dismissToast(id: number): void;
}

let toastSeq = 1;

export const useStore = create<State>((set, get) => ({
  status: "idle",
  error: null,
  dataSourceName: "local",

  contracts: [],
  contractsById: new Map(),
  items: [],
  payItemsByContract: new Map(),
  eoiDeltas: {},

  samplesList: [],
  testsList: [],
  testTemplates: [],

  users: [],
  currentUser: undefined,
  visibleIds: new Set(),

  savingCount: 0,
  toasts: [],

  async load() {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    try {
      const ds = await getDataSource();
      const { world, eoiDeltas } = await ds.loadWorld(DEFAULT_SEED_CONFIG);
      const users = buildDemoUsers(world.contracts, world.items);
      const savedId = (() => {
        try {
          return localStorage.getItem(USER_KEY);
        } catch {
          return null;
        }
      })();
      const currentUser = users.find((u) => u.id === savedId) ?? users.find((u) => u.id === DEFAULT_USER_ID) ?? users[0];
      set({
        status: "ready",
        dataSourceName: ds.name,
        contracts: world.contracts,
        contractsById: new Map(world.contracts.map((c) => [c.id, c])),
        items: world.items,
        payItemsByContract: world.payItemsByContract,
        eoiDeltas,
        samplesList: world.samples,
        testsList: world.tests,
        testTemplates: world.testTemplates,
        users,
        currentUser,
        visibleIds: visibleContractIds(currentUser, world.contracts),
      });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  setCurrentUser(id) {
    const user = get().users.find((u) => u.id === id);
    if (!user) return;
    try {
      localStorage.setItem(USER_KEY, id);
    } catch {
      /* non-fatal */
    }
    set({ currentUser: user, visibleIds: visibleContractIds(user, get().contracts) });
  },

  can: (cap) => canDo(get().currentUser, cap),
  canAccessContract: (contractId) => get().visibleIds.has(contractId),

  contract: (id) => get().contractsById.get(id),
  visibleContracts: () => {
    const vis = get().visibleIds;
    return get().contracts.filter((c) => vis.has(c.id));
  },
  inventoryForContract: (contractId) => get().items.filter((i) => i.contractId === contractId),
  payItemsFor: (contractId) => get().payItemsByContract.get(contractId) ?? [],

  reviewQueue: () => {
    const now = Date.now();
    const contractsById = get().contractsById;
    const vis = get().visibleIds;
    const queue: ReviewQueueItem[] = [];
    for (const it of get().items) {
      if (it.status !== "Ready for Review") continue;
      if (!vis.has(it.contractId)) continue;
      const c = contractsById.get(it.contractId);
      queue.push({
        ...it,
        contractName: c?.name ?? it.contractNumber,
        waitingMs: it.readyAt ? now - it.readyAt : 0,
        dedupeKey: `${it.contractId}|${it.materialCode}|${it.producerNumber}|${it.supplierNumber}`,
      });
    }
    queue.sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0)); // oldest waiting first
    return queue;
  },

  detail: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return undefined;
    const payItems = get().payItemsFor(item.contractId);
    const detail = buildDetail(item, payItems);
    // overlay persisted EOI approval deltas
    const deltas = get().eoiDeltas;
    detail.eoi = detail.eoi.map((row) => {
      const d = deltas[`${itemId}:${row.id}`];
      return d ? { ...row, approval: d.approval, note: d.note } : row;
    });
    return detail;
  },

  samples: () => {
    const vis = get().visibleIds;
    return get().samplesList.filter((s) => s.contractId === null || vis.has(s.contractId));
  },
  sample: (id) => get().samplesList.find((s) => s.id === id),
  testsForSample: (sampleId) =>
    get()
      .testsList.filter((t) => t.sampleId === sampleId)
      .sort((a, b) => a.series - b.series),

  setInventoryStatus(ids, status, opts) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const now = Date.now();
    const prev = new Map<string, { status: InventoryStatus; readyAt: number | null; note: string }>();
    const updates: { id: string; status: InventoryStatus; readyAt: number | null }[] = [];

    const items = get().items.map((it) => {
      if (!idSet.has(it.id)) return it;
      prev.set(it.id, { status: it.status, readyAt: it.readyAt, note: it.note });
      const readyAt =
        status === "Ready for Review" && it.status !== "Ready for Review" ? now : it.readyAt;
      const note = opts?.note ? appendNote(it.note, opts.note) : it.note;
      updates.push({ id: it.id, status, readyAt });
      return { ...it, status, readyAt, note };
    });
    set({ items });
    recomputeCounts(get, set, ids);

    void persist(get, set, async (ds) => ds.persistInventoryStatus(updates), () => {
      // rollback
      const rolled = get().items.map((it) =>
        prev.has(it.id) ? { ...it, ...prev.get(it.id)! } : it,
      );
      set({ items: rolled });
      recomputeCounts(get, set, ids);
    }, `Couldn't save ${ids.length === 1 ? "status change" : `${ids.length} status changes`}`);

    if (status === "Review Complete") {
      get().pushToast("success", `Marked ${ids.length} ${ids.length === 1 ? "item" : "items"} Review Complete`);
    }
  },

  setInventoryNote(id, note) {
    const prev = get().items.find((i) => i.id === id)?.note ?? "";
    set({ items: get().items.map((it) => (it.id === id ? { ...it, note } : it)) });
    void persist(get, set, async (ds) => ds.persistInventoryNote(id, note), () => {
      set({ items: get().items.map((it) => (it.id === id ? { ...it, note: prev } : it)) });
    }, "Couldn't save note");
  },

  setEoiApproval(itemId, eoiId, approval, note = "") {
    const key = `${itemId}:${eoiId}`;
    const prev = get().eoiDeltas[key];
    set({ eoiDeltas: { ...get().eoiDeltas, [key]: { approval, note } } });
    void persist(get, set, async (ds) => ds.persistEoiApproval(itemId, eoiId, approval, note), () => {
      const next = { ...get().eoiDeltas };
      if (prev) next[key] = prev;
      else delete next[key];
      set({ eoiDeltas: next });
    }, "Couldn't save EOI approval");
  },

  pushToast(kind, message) {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismissToast(id), kind === "error" ? 6000 : 3200);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

function appendNote(existing: string, addition: string): string {
  return existing ? `${existing}\n${addition}` : addition;
}

function recomputeCounts(get: () => State, set: (p: Partial<State>) => void, affectedIds: string[]) {
  const items = get().items;
  const affected = new Set(items.filter((i) => affectedIds.includes(i.id)).map((i) => i.contractId));
  if (affected.size === 0) return;
  const counts = new Map<string, number>();
  for (const it of items) {
    if (it.status === "Ready for Review" && affected.has(it.contractId)) {
      counts.set(it.contractId, (counts.get(it.contractId) ?? 0) + 1);
    }
  }
  const contracts = get().contracts.map((c) =>
    affected.has(c.id) ? { ...c, readyForReviewCount: counts.get(c.id) ?? 0 } : c,
  );
  set({
    contracts,
    contractsById: new Map(contracts.map((c) => [c.id, c])),
  });
}

async function persist(
  get: () => State,
  set: (p: Partial<State>) => void,
  run: (ds: Awaited<ReturnType<typeof getDataSource>>) => Promise<void>,
  rollback: () => void,
  failMessage: string,
) {
  set({ savingCount: get().savingCount + 1 });
  try {
    const ds = await getDataSource();
    await run(ds);
  } catch {
    rollback();
    get().pushToast("error", failMessage + " — change rolled back.");
  } finally {
    set({ savingCount: Math.max(0, get().savingCount - 1) });
  }
}
