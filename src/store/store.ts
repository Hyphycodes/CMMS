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
  SampleStatus,
  Test,
  TestTemplate,
  LedgerEntry,
  EOIEntry,
  PayItemMaterialStatus,
  SubcontractorRow,
  ProjectDocumentRow,
} from "@/domain/types";
import { getDataSource } from "@/data/dataSource";
import { DEFAULT_SEED_CONFIG, buildOverlaidDetail } from "@/data/seed/generate";
import type { EoiDelta, PayItemMaterialStatusDelta } from "@/data/dataSource";
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
  ledgerDeltas: Record<string, LedgerEntry[]>;
  eoiRowDeltas: Record<string, EOIEntry[]>;
  payItemStatusDeltas: Record<string, PayItemMaterialStatusDelta>;

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

  // inventory writes (brief 05)
  upsertInventoryItem(item: InventoryItem): void;
  setLedger(itemId: string, rows: LedgerEntry[]): void;
  setEoi(itemId: string, rows: EOIEntry[]): void;
  setPayItemMaterialStatus(itemId: string, payItemNumber: string, status: PayItemMaterialStatus, note?: string): void;

  // contract sub-tabs (brief 06) — in-memory until persistence lands in brief 12
  addSubcontractor(contractId: string, row: SubcontractorRow): void;
  addProjectDocument(contractId: string, row: ProjectDocumentRow): void;

  // samples + tests (briefs 03–04)
  upsertSample(sample: Sample): void;
  setSampleStatus(id: string, status: SampleStatus): void;
  approveSample(id: string, opts: { approve: boolean; note?: string }): void;
  upsertTest(test: Test): void;
  validateTest(testId: string, validate: boolean): void;

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
  ledgerDeltas: {},
  eoiRowDeltas: {},
  payItemStatusDeltas: {},

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
      const { world, eoiDeltas, ledgerDeltas, eoiRowDeltas, payItemStatusDeltas } =
        await ds.loadWorld(DEFAULT_SEED_CONFIG);
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
        ledgerDeltas,
        eoiRowDeltas,
        payItemStatusDeltas,
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
    return buildOverlaidDetail(item, payItems, {
      eoiApproval: get().eoiDeltas,
      ledger: get().ledgerDeltas,
      eoiRows: get().eoiRowDeltas,
      payItemStatus: get().payItemStatusDeltas,
    });
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

  upsertInventoryItem(item) {
    if (!canDo(get().currentUser, "create_inventory")) {
      get().pushToast("error", "Your role can't create or edit inventory.");
      return;
    }
    const list = get().items;
    const idx = list.findIndex((i) => i.id === item.id);
    const prev = idx >= 0 ? list[idx] : null;
    set({ items: idx >= 0 ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item] });
    recomputeContractCounts(get, set, item.contractId);
    void persist(
      get,
      set,
      async (ds) => ds.persistInventoryItem(item),
      () => {
        const cur = get().items;
        set({ items: prev ? cur.map((i) => (i.id === item.id ? prev : i)) : cur.filter((i) => i.id !== item.id) });
        recomputeContractCounts(get, set, item.contractId);
      },
      "Couldn't save inventory",
    );
  },

  setLedger(itemId, rows) {
    if (!canDo(get().currentUser, "create_inventory")) {
      get().pushToast("error", "Your role can't edit the Quantity Ledger.");
      return;
    }
    const prev = get().ledgerDeltas[itemId];
    set({ ledgerDeltas: { ...get().ledgerDeltas, [itemId]: rows } });
    void persist(
      get,
      set,
      async (ds) => ds.persistLedger(itemId, rows),
      () => {
        const next = { ...get().ledgerDeltas };
        if (prev) next[itemId] = prev;
        else delete next[itemId];
        set({ ledgerDeltas: next });
      },
      "Couldn't save ledger",
    );
  },

  setEoi(itemId, rows) {
    if (!canDo(get().currentUser, "upload_eoi")) {
      get().pushToast("error", "Your role can't edit Evidence of Inspection rows.");
      return;
    }
    const prev = get().eoiRowDeltas[itemId];
    set({ eoiRowDeltas: { ...get().eoiRowDeltas, [itemId]: rows } });
    void persist(
      get,
      set,
      async (ds) => ds.persistEoi(itemId, rows),
      () => {
        const next = { ...get().eoiRowDeltas };
        if (prev) next[itemId] = prev;
        else delete next[itemId];
        set({ eoiRowDeltas: next });
      },
      "Couldn't save EOI rows",
    );
  },

  setPayItemMaterialStatus(itemId, payItemNumber, status, note = "") {
    if (!canDo(get().currentUser, "set_pay_item_material_status")) {
      get().pushToast("error", "Only Documentation / Admin can set Pay Item Material Status.");
      return;
    }
    const key = `${itemId}:${payItemNumber}`;
    const prev = get().payItemStatusDeltas[key];
    set({ payItemStatusDeltas: { ...get().payItemStatusDeltas, [key]: { status, note } } });
    void persist(
      get,
      set,
      async (ds) => ds.persistPayItemMaterialStatus(itemId, payItemNumber, status, note),
      () => {
        const next = { ...get().payItemStatusDeltas };
        if (prev) next[key] = prev;
        else delete next[key];
        set({ payItemStatusDeltas: next });
      },
      "Couldn't save Pay Item Material Status",
    );
  },

  addSubcontractor(contractId, row) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't add subcontractors.");
      return;
    }
    updateContractInMemory(get, set, contractId, (c) => ({ ...c, subcontractors: [...c.subcontractors, row] }));
    get().pushToast("info", "Subcontractor added (syncs to the backend in brief 12).");
  },

  addProjectDocument(contractId, row) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't add documents.");
      return;
    }
    updateContractInMemory(get, set, contractId, (c) => ({ ...c, projectDocuments: [...c.projectDocuments, row] }));
    get().pushToast("info", "Document added (file upload + storage lands in brief 12).");
  },

  upsertSample(sample) {
    if (!canDo(get().currentUser, "create_sample")) {
      get().pushToast("error", "Your role can't create or edit samples.");
      return;
    }
    saveSample(get, set, sample, "Couldn't save sample");
  },

  setSampleStatus(id, status) {
    if (!canDo(get().currentUser, "enter_tests")) {
      get().pushToast("error", "Only an inspector / lab can advance a sample's testing status.");
      return;
    }
    const existing = get().samplesList.find((s) => s.id === id);
    if (!existing) return;
    saveSample(get, set, { ...existing, status }, "Couldn't save sample status");
  },

  approveSample(id, opts) {
    if (!canDo(get().currentUser, "approve_sample")) {
      get().pushToast("error", "Only Documentation / Admin can approve or reject a sample.");
      return;
    }
    const existing = get().samplesList.find((s) => s.id === id);
    if (!existing) return;
    const next: Sample = {
      ...existing,
      status: opts.approve ? "Approved" : "Rejected",
      approverName: get().currentUser?.name ?? "",
      approvedDate: new Date().toISOString().slice(0, 10),
      note: opts.note ? appendNote(existing.note, opts.note) : existing.note,
    };
    saveSample(get, set, next, opts.approve ? "Couldn't approve sample" : "Couldn't reject sample");
    get().pushToast("success", opts.approve ? "Sample approved" : "Sample rejected");
  },

  upsertTest(test) {
    if (!canDo(get().currentUser, "enter_tests")) {
      get().pushToast("error", "Only an inspector / lab can enter test records.");
      return;
    }
    saveTest(get, set, test, "Couldn't save test");
  },

  validateTest(testId, validate) {
    if (!canDo(get().currentUser, "validate_test")) {
      get().pushToast("error", "Your role can't validate tests.");
      return;
    }
    const existing = get().testsList.find((t) => t.id === testId);
    if (!existing) return;
    const next: Test = {
      ...existing,
      validated: validate,
      validatedBy: validate ? (get().currentUser?.name ?? "") : "",
      validatedAt: validate ? new Date().toISOString().slice(0, 10) : null,
    };
    saveTest(get, set, next, "Couldn't save validation");
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

function saveSample(
  get: () => State,
  set: (p: Partial<State>) => void,
  sample: Sample,
  failMessage: string,
) {
  const list = get().samplesList;
  const idx = list.findIndex((s) => s.id === sample.id);
  const prev = idx >= 0 ? list[idx] : null;
  set({ samplesList: idx >= 0 ? list.map((s) => (s.id === sample.id ? sample : s)) : [...list, sample] });
  void persist(
    get,
    set,
    async (ds) => ds.persistSample(sample),
    () => {
      const cur = get().samplesList;
      set({
        samplesList: prev ? cur.map((s) => (s.id === sample.id ? prev : s)) : cur.filter((s) => s.id !== sample.id),
      });
    },
    failMessage,
  );
}

function saveTest(get: () => State, set: (p: Partial<State>) => void, test: Test, failMessage: string) {
  const list = get().testsList;
  const idx = list.findIndex((t) => t.id === test.id);
  const prev = idx >= 0 ? list[idx] : null;
  set({ testsList: idx >= 0 ? list.map((t) => (t.id === test.id ? test : t)) : [...list, test] });
  void persist(
    get,
    set,
    async (ds) => ds.persistTest(test),
    () => {
      const cur = get().testsList;
      set({
        testsList: prev ? cur.map((t) => (t.id === test.id ? prev : t)) : cur.filter((t) => t.id !== test.id),
      });
    },
    failMessage,
  );
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

function updateContractInMemory(
  get: () => State,
  set: (p: Partial<State>) => void,
  contractId: string,
  fn: (c: Contract) => Contract,
) {
  const contracts = get().contracts.map((c) => (c.id === contractId ? fn(c) : c));
  set({ contracts, contractsById: new Map(contracts.map((c) => [c.id, c])) });
}

function recomputeContractCounts(get: () => State, set: (p: Partial<State>) => void, contractId: string) {
  let inv = 0;
  let ready = 0;
  for (const it of get().items) {
    if (it.contractId !== contractId) continue;
    inv++;
    if (it.status === "Ready for Review") ready++;
  }
  const contracts = get().contracts.map((c) =>
    c.id === contractId ? { ...c, inventoryCount: inv, readyForReviewCount: ready } : c,
  );
  set({ contracts, contractsById: new Map(contracts.map((c) => [c.id, c])) });
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
