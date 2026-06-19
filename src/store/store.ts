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
  DiaryDay,
  DiarySuspension,
  PlacementEntry,
  PayEstimate,
  Authorization,
  MixDesign,
  Provenance,
} from "@/domain/types";
import { lineAmount, sumAmounts } from "@/domain/money";
import { getDataSource } from "@/data/dataSource";
import { DEFAULT_SEED_CONFIG, buildOverlaidDetail, buildDiaryDay } from "@/data/seed/generate";
import type { EoiDelta, PayItemMaterialStatusDelta } from "@/data/dataSource";
import { buildDemoUsers, DEFAULT_USER_ID } from "@/auth/demoUsers";
import { can as canDo, visibleContractIds, type Capability } from "@/auth/permissions";
import * as deltaLog from "@/data/deltaLog";
import { stamp as stampProvenance, stamperFromUser } from "@/domain/provenance";

const USER_KEY = "proof:user:v1";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

/** A document attached to an inventory item (in-memory; brief 61D34 task 4a). */
export interface InventoryDoc {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string; // object URL (session-scoped)
  addedAt: string;
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

  // diary (brief 07)
  diaryDeltas: Record<string, DiaryDay>;
  suspensionsByContract: Map<string, DiarySuspension[]>;

  // quantity book (brief 08)
  placementsList: PlacementEntry[];

  // pay estimate (brief 09)
  payEstimatesList: PayEstimate[];

  // authorizations (brief 10)
  authorizationsList: Authorization[];

  // materials admin (brief 11)
  mixDesignsList: MixDesign[];

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

  // F1 — offline-first: online state + queued (un-synced) op count.
  online: boolean;
  pendingChanges: number;
  flushPending(): Promise<void>;

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
  diaryDay(contractId: string, date: string): DiaryDay | undefined;
  diaryRange(contractId: string, from: string, to: string): DiaryDay[];
  suspensions(contractId: string): DiarySuspension[];
  placementsForContract(contractId: string): PlacementEntry[];
  placementsForPayItem(contractId: string, payItemNumber: string): PlacementEntry[];
  payEstimatesForContract(contractId: string): PayEstimate[];
  authorizationsForContract(contractId: string): Authorization[];

  // mutations (optimistic)
  setInventoryStatus(ids: string[], status: InventoryStatus, opts?: { note?: string }): void;
  setInventoryNote(id: string, note: string): void;
  setEoiApproval(itemId: string, eoiId: string, approval: EOIApproval, note?: string): void;

  // inventory document attachments (in-memory; brief 61D34 task 4a)
  inventoryDocs: Record<string, InventoryDoc[]>;
  addInventoryDocs(itemId: string, docs: InventoryDoc[]): void;
  removeInventoryDoc(itemId: string, docId: string): void;

  // inventory writes (brief 05)
  upsertInventoryItem(item: InventoryItem): void;
  setLedger(itemId: string, rows: LedgerEntry[]): void;
  setEoi(itemId: string, rows: EOIEntry[]): void;
  setPayItemMaterialStatus(itemId: string, payItemNumber: string, status: PayItemMaterialStatus, note?: string): void;

  // contract sub-tabs (brief 06) — in-memory until persistence lands in brief 12
  addSubcontractor(contractId: string, row: SubcontractorRow): void;
  addProjectDocument(contractId: string, row: ProjectDocumentRow): void;

  // diary (brief 07)
  saveDiaryDay(day: DiaryDay): void;
  signDiaryDay(contractId: string, date: string): void;
  addSuspension(suspension: DiarySuspension): void;

  // quantity book (brief 08)
  savePlacement(placement: PlacementEntry): void;
  deletePlacement(id: string): void;
  updatePayItem(contractId: string, payItem: PayItem): void;
  finalizePayItem(contractId: string, payItemNumber: string, final: boolean): void;

  // pay estimate (brief 09)
  createPayEstimate(contractId: string, periodStart: string, periodEnd: string): string | undefined;
  submitPayEstimate(id: string): void;

  // authorizations (brief 10)
  saveAuthorization(authorization: Authorization): void;
  submitAuthorization(id: string): void;
  advanceAuthApproval(id: string): void;

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
  inventoryDocs: {},

  diaryDeltas: {},
  suspensionsByContract: new Map(),

  placementsList: [],
  payEstimatesList: [],
  authorizationsList: [],
  mixDesignsList: [],

  samplesList: [],
  testsList: [],
  testTemplates: [],

  users: [],
  currentUser: undefined,
  visibleIds: new Set(),

  savingCount: 0,
  toasts: [],

  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pendingChanges: 0,

  async flushPending() {
    try {
      const ds = await getDataSource();
      await ds.flush();
    } catch {
      /* stay queued */
    }
    set({ pendingChanges: deltaLog.unsyncedCount() });
  },

  async load() {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    try {
      const ds = await getDataSource();
      const { world, eoiDeltas, ledgerDeltas, eoiRowDeltas, payItemStatusDeltas, diaryDeltas } =
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
      if (currentUser) deltaLog.setActor({ userId: currentUser.id, orgId: currentUser.orgId });
      // F1 — keep the pending-changes pill live; flush automatically on reconnect.
      deltaLog.subscribe(() => set({ pendingChanges: deltaLog.unsyncedCount() }));
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
          set({ online: true });
          void get().flushPending();
        });
        window.addEventListener("offline", () => set({ online: false }));
      }
      set({
        status: "ready",
        pendingChanges: deltaLog.unsyncedCount(),
        dataSourceName: ds.name,
        contracts: world.contracts,
        contractsById: new Map(world.contracts.map((c) => [c.id, c])),
        items: world.items,
        payItemsByContract: world.payItemsByContract,
        eoiDeltas,
        ledgerDeltas,
        eoiRowDeltas,
        payItemStatusDeltas,
        diaryDeltas,
        suspensionsByContract: world.suspensionsByContract,
        placementsList: world.placements,
        payEstimatesList: world.payEstimates,
        authorizationsList: world.authorizations,
        mixDesignsList: world.mixDesigns,
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
    deltaLog.setActor({ userId: user.id, orgId: user.orgId });
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

  diaryDay: (contractId, date) => {
    const delta = get().diaryDeltas[`${contractId}:${date}`];
    if (delta) return delta;
    const contract = get().contractsById.get(contractId);
    return contract ? buildDiaryDay(contract, date) : undefined;
  },
  diaryRange: (contractId, from, to) => {
    const contract = get().contractsById.get(contractId);
    if (!contract) return [];
    const out: DiaryDay[] = [];
    const start = new Date(from + "T00:00:00").getTime();
    const end = new Date(to + "T00:00:00").getTime();
    const deltas = get().diaryDeltas;
    for (let t = start; t <= end; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      out.push(deltas[`${contractId}:${date}`] ?? buildDiaryDay(contract, date));
    }
    return out;
  },
  suspensions: (contractId) => get().suspensionsByContract.get(contractId) ?? [],
  placementsForContract: (contractId) => get().placementsList.filter((p) => p.contractId === contractId),
  placementsForPayItem: (contractId, payItemNumber) =>
    get().placementsList.filter((p) => p.contractId === contractId && p.payItemNumber === payItemNumber),
  payEstimatesForContract: (contractId) =>
    get()
      .payEstimatesList.filter((e) => e.contractId === contractId)
      .sort((a, b) => a.number - b.number),
  authorizationsForContract: (contractId) =>
    get()
      .authorizationsList.filter((a) => a.contractId === contractId)
      .sort((a, b) => a.number - b.number),

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
    item = stamped(get, item, idx < 0);
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

  addInventoryDocs(itemId, docs) {
    const cur = get().inventoryDocs[itemId] ?? [];
    set({ inventoryDocs: { ...get().inventoryDocs, [itemId]: [...cur, ...docs] } });
  },

  removeInventoryDoc(itemId, docId) {
    const cur = get().inventoryDocs[itemId] ?? [];
    const doc = cur.find((d) => d.id === docId);
    if (doc) URL.revokeObjectURL(doc.url);
    set({ inventoryDocs: { ...get().inventoryDocs, [itemId]: cur.filter((d) => d.id !== docId) } });
  },

  setLedger(itemId, rows) {
    if (!canDo(get().currentUser, "create_inventory")) {
      get().pushToast("error", "Your role can't edit the Quantity Ledger.");
      return;
    }
    const prev = get().ledgerDeltas[itemId];
    rows = rows.map((r) => stamped(get, r, !r.createdAt));
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
    rows = rows.map((r) => stamped(get, r, !r.createdAt));
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

  saveDiaryDay(day) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't edit the diary.");
      return;
    }
    const key = `${day.contractId}:${day.date}`;
    const prev = get().diaryDeltas[key];
    day = stamped(get, day, !prev);
    set({ diaryDeltas: { ...get().diaryDeltas, [key]: day } });
    void persist(
      get,
      set,
      async (ds) => ds.persistDiaryDay(day),
      () => {
        const next = { ...get().diaryDeltas };
        if (prev) next[key] = prev;
        else delete next[key];
        set({ diaryDeltas: next });
      },
      "Couldn't save diary",
    );
  },

  signDiaryDay(contractId, date) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't sign the diary.");
      return;
    }
    const day = get().diaryDay(contractId, date);
    if (!day) return;
    const signed: DiaryDay = {
      ...day,
      signedBy: get().currentUser?.name ?? "",
      signedAt: new Date().toISOString().slice(0, 10),
    };
    get().saveDiaryDay(signed);
    get().pushToast("success", `Diary signed for ${date}`);
  },

  addSuspension(suspension) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't suspend the contract.");
      return;
    }
    const map = new Map(get().suspensionsByContract);
    const arr = [...(map.get(suspension.contractId) ?? []), suspension];
    map.set(suspension.contractId, arr);
    set({ suspensionsByContract: map });
    void persist(
      get,
      set,
      async (ds) => ds.persistSuspension(suspension),
      () => {
        const m = new Map(get().suspensionsByContract);
        m.set(suspension.contractId, (m.get(suspension.contractId) ?? []).filter((x) => x !== suspension));
        set({ suspensionsByContract: m });
      },
      "Couldn't save suspension",
    );
  },

  savePlacement(placement) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't edit placements.");
      return;
    }
    const list = get().placementsList;
    const idx = list.findIndex((p) => p.id === placement.id);
    const prev = idx >= 0 ? list[idx] : null;
    placement = stamped(get, placement, idx < 0);
    set({ placementsList: idx >= 0 ? list.map((p) => (p.id === placement.id ? placement : p)) : [...list, placement] });
    void persist(
      get,
      set,
      async (ds) => ds.persistPlacement(placement),
      () => {
        const cur = get().placementsList;
        set({ placementsList: prev ? cur.map((p) => (p.id === placement.id ? prev : p)) : cur.filter((p) => p.id !== placement.id) });
      },
      "Couldn't save placement",
    );
  },

  deletePlacement(id) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't delete placements.");
      return;
    }
    const list = get().placementsList;
    const prev = list.find((p) => p.id === id);
    if (!prev) return;
    set({ placementsList: list.filter((p) => p.id !== id) });
    void persist(
      get,
      set,
      async (ds) => ds.persistPlacement({ ...prev, quantity: 0, type: "Adjustment", posted: false }),
      () => set({ placementsList: [...get().placementsList, prev] }),
      "Couldn't delete placement",
    );
  },

  updatePayItem(contractId, payItem) {
    const map = new Map(get().payItemsByContract);
    const prev = (map.get(contractId) ?? []).slice();
    const list = (map.get(contractId) ?? []).map((p) => (p.number === payItem.number ? payItem : p));
    map.set(contractId, list);
    set({ payItemsByContract: map });
    void persist(
      get,
      set,
      async (ds) => ds.persistPayItem(contractId, payItem),
      () => {
        const m = new Map(get().payItemsByContract);
        m.set(contractId, prev);
        set({ payItemsByContract: m });
      },
      "Couldn't save pay item",
    );
  },

  finalizePayItem(contractId, payItemNumber, final) {
    if (!canDo(get().currentUser, "author_contract")) {
      get().pushToast("error", "Your role can't finalize pay items.");
      return;
    }
    const pi = (get().payItemsByContract.get(contractId) ?? []).find((p) => p.number === payItemNumber);
    if (!pi) return;
    get().updatePayItem(contractId, { ...pi, final });
    get().pushToast("success", final ? `Pay item ${payItemNumber} finaled` : `Pay item ${payItemNumber} reopened`);
  },

  createPayEstimate(contractId, periodStart, periodEnd) {
    if (!canDo(get().currentUser, "submit_pay_estimate")) {
      get().pushToast("error", "Your role can't create pay estimates.");
      return undefined;
    }
    const payItems = get().payItemsByContract.get(contractId) ?? [];
    const eligible = get().placementsList.filter(
      (p) =>
        p.contractId === contractId &&
        p.type === "Placed" &&
        p.posted &&
        p.payEstimateId === null &&
        p.date >= periodStart &&
        p.date <= periodEnd,
    );
    if (eligible.length === 0) {
      get().pushToast("info", "No eligible placements (Placed, posted, not on a prior estimate) in that period.");
      return undefined;
    }
    const existing = get().payEstimatesList.filter((e) => e.contractId === contractId);
    const number = existing.length ? Math.max(...existing.map((e) => e.number)) + 1 : 1;
    const id = `pe_new_${contractId}_${Date.now()}`;
    const byItem = new Map<string, PlacementEntry[]>();
    for (const p of eligible) {
      const arr = byItem.get(p.payItemNumber);
      if (arr) arr.push(p);
      else byItem.set(p.payItemNumber, [p]);
    }
    const lines = [...byItem.entries()].map(([num, ps]) => {
      const pi = payItems.find((x) => x.number === num);
      const qty = ps.reduce((s, p) => s + p.quantity, 0);
      const price = pi?.unitPrice ?? ps[0].price;
      return { payItemNumber: num, description: pi?.description ?? "—", unit: pi?.unit ?? "", quantityThis: qty, unitPrice: price, amount: lineAmount(qty, price) };
    });
    const thisTotal = sumAmounts(lines.map((l) => l.amount));
    const priorToDate = existing.reduce((s, e) => s + e.thisEstimateTotal, 0);
    const estimateBase: PayEstimate = {
      id,
      contractId,
      number,
      periodStart,
      periodEnd,
      status: "Draft",
      submittedBy: null,
      submittedAt: null,
      lines,
      thisEstimateTotal: thisTotal,
      toDateTotal: Math.round((priorToDate + thisTotal) * 100) / 100,
    };
    const estimate = stamped(get, estimateBase, true);
    set({ payEstimatesList: [...get().payEstimatesList, estimate] });
    // mark consumed placements (optimistic) so they can't be double-counted
    const consumed = new Set(eligible.map((p) => p.id));
    set({ placementsList: get().placementsList.map((p) => (consumed.has(p.id) ? { ...p, payEstimateId: id } : p)) });
    void persist(
      get,
      set,
      async (ds) => {
        await ds.persistPayEstimate(estimate);
        for (const p of eligible) await ds.persistPlacement({ ...p, payEstimateId: id });
      },
      () => {
        set({
          payEstimatesList: get().payEstimatesList.filter((e) => e.id !== id),
          placementsList: get().placementsList.map((p) => (consumed.has(p.id) ? { ...p, payEstimateId: null } : p)),
        });
      },
      "Couldn't create pay estimate",
    );
    get().pushToast("success", `Created Estimate #${number} (${lines.length} line items)`);
    return id;
  },

  submitPayEstimate(id) {
    if (!canDo(get().currentUser, "submit_pay_estimate")) {
      get().pushToast("error", "Your role can't submit pay estimates.");
      return;
    }
    const est = get().payEstimatesList.find((e) => e.id === id);
    if (!est || est.status !== "Draft") return;
    const next: PayEstimate = {
      ...est,
      status: "Submitted",
      submittedBy: get().currentUser?.name ?? "",
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    const prev = est;
    set({ payEstimatesList: get().payEstimatesList.map((e) => (e.id === id ? next : e)) });
    void persist(
      get,
      set,
      async (ds) => ds.persistPayEstimate(next),
      () => set({ payEstimatesList: get().payEstimatesList.map((e) => (e.id === id ? prev : e)) }),
      "Couldn't submit pay estimate",
    );
    get().pushToast("success", `Submitted Estimate #${est.number}`);
  },

  saveAuthorization(authorization) {
    if (!canDo(get().currentUser, "manage_authorization")) {
      get().pushToast("error", "Your role can't manage authorizations.");
      return;
    }
    const withNet: Authorization = {
      ...authorization,
      netChange: sumAmounts(authorization.items.map((i) => lineAmount(i.quantity, i.unitPrice))),
    };
    const list = get().authorizationsList;
    const idx = list.findIndex((a) => a.id === withNet.id);
    const prev = idx >= 0 ? list[idx] : null;
    set({ authorizationsList: idx >= 0 ? list.map((a) => (a.id === withNet.id ? withNet : a)) : [...list, withNet] });
    void persist(
      get,
      set,
      async (ds) => ds.persistAuthorization(withNet),
      () => {
        const cur = get().authorizationsList;
        set({ authorizationsList: prev ? cur.map((a) => (a.id === withNet.id ? prev : a)) : cur.filter((a) => a.id !== withNet.id) });
      },
      "Couldn't save authorization",
    );
  },

  submitAuthorization(id) {
    if (!canDo(get().currentUser, "manage_authorization")) {
      get().pushToast("error", "Your role can't submit authorizations.");
      return;
    }
    const auth = get().authorizationsList.find((a) => a.id === id);
    if (!auth || auth.status !== "Draft") return;
    saveAuth(get, set, { ...auth, status: "In Approval" });
    get().pushToast("info", `Authorization #${auth.number} routed for approval`);
  },

  advanceAuthApproval(id) {
    if (!canDo(get().currentUser, "manage_authorization")) {
      get().pushToast("error", "Your role can't approve authorizations.");
      return;
    }
    const auth = get().authorizationsList.find((a) => a.id === id);
    if (!auth || auth.status === "Published") return;
    const nextStep = auth.approvals.findIndex((a) => a.approver === null);
    if (nextStep === -1) return;
    const today = new Date().toISOString().slice(0, 10);
    const approvals = auth.approvals.map((a, i) =>
      i === nextStep ? { ...a, approver: get().currentUser?.name ?? "", approvedAt: today } : a,
    );
    const allSigned = approvals.every((a) => a.approver !== null);

    if (!allSigned) {
      saveAuth(get, set, { ...auth, status: "In Approval", approvals });
      get().pushToast("success", `Approved step: ${auth.approvals[nextStep].step}`);
      return;
    }

    // Final approval → Publish + propagate to pay items + contract value (ONE path).
    const published: Authorization = { ...auth, status: "Published", approvals };
    saveAuth(get, set, published);
    const payItems = get().payItemsByContract.get(auth.contractId) ?? [];
    for (const item of published.items) {
      const existing = payItems.find((p) => p.number === item.payItemNumber);
      if (existing) {
        get().updatePayItem(auth.contractId, { ...existing, awardedQuantity: existing.awardedQuantity + item.quantity });
      } else {
        get().updatePayItem(auth.contractId, {
          number: item.payItemNumber,
          description: item.description,
          unit: item.unit,
          unitPrice: item.unitPrice,
          awardedQuantity: item.quantity,
          placedQuantity: 0,
        });
      }
    }
    const contract = get().contractsById.get(auth.contractId);
    if (contract) {
      updateContractInMemory(get, set, auth.contractId, (c) => ({
        ...c,
        summary: {
          ...c.summary,
          adjustmentAmount: Math.round((c.summary.adjustmentAmount + published.netChange) * 100) / 100,
          currentContractAmount: Math.round((c.summary.currentContractAmount + published.netChange) * 100) / 100,
        },
      }));
    }
    get().pushToast("success", `Authorization #${auth.number} published — pay items + contract value updated`);
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

/**
 * F2 — stamp provenance from the current user. The single path every write goes
 * through; actions never hand-set createdBy/updatedBy/version.
 */
function stamped<T extends Provenance>(get: () => State, entity: T, isNew?: boolean): T {
  return stampProvenance(entity, stamperFromUser(get().currentUser), { isNew });
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
  sample = stamped(get, sample, idx < 0);
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

function saveAuth(get: () => State, set: (p: Partial<State>) => void, auth: Authorization) {
  const list = get().authorizationsList;
  const prev = list.find((a) => a.id === auth.id) ?? null;
  auth = stamped(get, auth, !prev);
  set({ authorizationsList: list.map((a) => (a.id === auth.id ? auth : a)) });
  void persist(
    get,
    set,
    async (ds) => ds.persistAuthorization(auth),
    () => {
      if (prev) set({ authorizationsList: get().authorizationsList.map((a) => (a.id === auth.id ? prev : a)) });
    },
    "Couldn't save authorization",
  );
}

function saveTest(get: () => State, set: (p: Partial<State>) => void, test: Test, failMessage: string) {
  const list = get().testsList;
  const idx = list.findIndex((t) => t.id === test.id);
  const prev = idx >= 0 ? list[idx] : null;
  test = stamped(get, test, idx < 0);
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
