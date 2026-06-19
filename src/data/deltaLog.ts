/**
 * F1 — Durable, replayable delta log (offline-first foundation).
 *
 * Every write in Proof emits a `DeltaOp` envelope into an append-only, ordered,
 * idempotent log backed by IndexedDB. The log is the source of truth for deltas:
 *   loadWorld = seed, then replay the log in `seq` order (pure + deterministic).
 *
 * Offline is "just queue locally, flush on reconnect." Ops appended while offline
 * are marked `synced: false`; `flush()` drains them when a backend is wired
 * (Supabase) and marks each synced — in pure-local mode flush is a durable no-op.
 * The number of un-synced ops drives an unobtrusive "N changes pending" pill.
 *
 * A localStorage fallback keeps the log working where IndexedDB is unavailable
 * (private windows, the seed script run under tsx). The legacy `proof:deltas:v1`
 * blob is migrated into the log on first load, then kept as a materialized cache.
 */

export type DeltaEntity =
  | "inventoryStatus"
  | "inventoryNote"
  | "eoiApproval"
  | "sample"
  | "test"
  | "inventoryItem"
  | "inventoryActive"
  | "ledger"
  | "eoi"
  | "payItemStatus"
  | "diaryDay"
  | "suspension"
  | "placement"
  | "payItem"
  | "payEstimate"
  | "authorization"
  | "contractSummary"
  | "finalReview"
  | "materialAllowance"
  | "qmpPackage"
  | "employee"
  | "contract"
  | "fileRefs"
  | "import";

export interface DeltaOp {
  /** stable idempotency key — re-appending the same id is a no-op */
  id: string;
  /** assigned on append; total order for replay */
  seq: number;
  /** epoch ms */
  ts: number;
  userId: string;
  orgId: string;
  entity: DeltaEntity;
  entityId: string;
  op: "upsert" | "delete";
  payload: unknown;
  /** the entity version this op was computed from (P6 stale-write guard) */
  baseVersion: number | null;
  /** false while queued offline / not yet acknowledged by a backend */
  synced: boolean;
}

/** Who is making writes right now — stamped onto every op (and provenance, F2). */
export interface Actor {
  userId: string;
  orgId: string;
}

let actor: Actor = { userId: "system", orgId: "IDOT" };
export function setActor(next: Actor): void {
  actor = next;
}
export function getActor(): Actor {
  return actor;
}

const DB_NAME = "proof";
const STORE = "deltaLog";
const LS_FALLBACK = "proof:deltalog:v1";

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

// --- IndexedDB plumbing ----------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "seq" });
      }
      if (!db.objectStoreNames.contains("files")) {
        // S1 (file storage) shares this database.
        db.createObjectStore("files", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbAll(): Promise<DeltaOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as DeltaOp[]).sort((a, b) => a.seq - b.seq));
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(ops: DeltaOp[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const op of ops) store.put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- file blobs (S1) — bytes live in the shared `files` store ---------------

interface FileBlobRow {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
}

export async function putFileBlob(row: FileBlobRow): Promise<void> {
  if (!hasIndexedDB()) return; // bytes can't persist without IndexedDB; ref still works in-session
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFileBlob(id: string): Promise<FileBlobRow | undefined> {
  if (!hasIndexedDB()) return undefined;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("files", "readonly").objectStore("files").get(id);
    req.onsuccess = () => resolve(req.result as FileBlobRow | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFileBlob(id: string): Promise<void> {
  if (!hasIndexedDB()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- localStorage fallback -------------------------------------------------

function lsAll(): DeltaOp[] {
  try {
    const raw = localStorage.getItem(LS_FALLBACK);
    return raw ? (JSON.parse(raw) as DeltaOp[]) : [];
  } catch {
    return [];
  }
}
function lsWrite(ops: DeltaOp[]): void {
  try {
    localStorage.setItem(LS_FALLBACK, JSON.stringify(ops));
  } catch {
    /* non-fatal */
  }
}

// --- public API ------------------------------------------------------------

let cache: DeltaOp[] | null = null;
let seqCounter = 0;
const seenIds = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Load the log into memory (idempotent). Returns the ordered ops. */
export async function init(): Promise<DeltaOp[]> {
  if (cache) return cache;
  const ops = hasIndexedDB() ? await idbAll() : lsAll();
  cache = ops;
  for (const op of ops) {
    seenIds.add(op.id);
    if (op.seq >= seqCounter) seqCounter = op.seq + 1;
  }
  return cache;
}

/** All ops in seq order (in-memory; call `init()` first). */
export function all(): DeltaOp[] {
  return cache ?? [];
}

export function unsyncedCount(): number {
  return (cache ?? []).filter((o) => !o.synced).length;
}

/**
 * Append one op. Idempotent on `id` (re-appending is a no-op). Stamps actor,
 * ts, seq and the current online state. Returns the appended (or existing) op.
 */
export async function append(input: {
  id: string;
  entity: DeltaEntity;
  entityId: string;
  op?: "upsert" | "delete";
  payload: unknown;
  baseVersion?: number | null;
}): Promise<DeltaOp> {
  await init();
  if (seenIds.has(input.id)) {
    return (cache ?? []).find((o) => o.id === input.id)!;
  }
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const entry: DeltaOp = {
    id: input.id,
    seq: seqCounter++,
    ts: Date.now(),
    userId: actor.userId,
    orgId: actor.orgId,
    entity: input.entity,
    entityId: input.entityId,
    op: input.op ?? "upsert",
    payload: input.payload,
    baseVersion: input.baseVersion ?? null,
    synced: online,
  };
  seenIds.add(entry.id);
  cache = [...(cache ?? []), entry];
  if (hasIndexedDB()) await idbPut([entry]);
  else lsWrite(cache);
  notify();
  return entry;
}

/**
 * Drain un-synced ops through `sink` (the backend write). Each op that the sink
 * accepts is marked synced. In pure-local mode pass no sink: ops are durable
 * already, so they're simply marked synced and the pending pill clears.
 */
export async function flush(sink?: (op: DeltaOp) => Promise<void>): Promise<number> {
  await init();
  const pending = (cache ?? []).filter((o) => !o.synced);
  if (pending.length === 0) return 0;
  const flushed: DeltaOp[] = [];
  for (const op of pending) {
    try {
      if (sink) await sink(op);
      flushed.push({ ...op, synced: true });
    } catch {
      break; // stop on first failure; the rest stay queued
    }
  }
  if (flushed.length) {
    const byId = new Map(flushed.map((o) => [o.id, o]));
    cache = (cache ?? []).map((o) => byId.get(o.id) ?? o);
    if (hasIndexedDB()) await idbPut(flushed);
    else lsWrite(cache);
    notify();
  }
  return flushed.length;
}

/** Append a batch atomically (used by the legacy-blob migration). */
export async function appendBatch(
  inputs: { id: string; entity: DeltaEntity; entityId: string; payload: unknown }[],
): Promise<void> {
  await init();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const fresh: DeltaOp[] = [];
  for (const input of inputs) {
    if (seenIds.has(input.id)) continue;
    const entry: DeltaOp = {
      id: input.id,
      seq: seqCounter++,
      ts: Date.now(),
      userId: actor.userId,
      orgId: actor.orgId,
      entity: input.entity,
      entityId: input.entityId,
      op: "upsert",
      payload: input.payload,
      baseVersion: null,
      synced: online,
    };
    seenIds.add(entry.id);
    fresh.push(entry);
  }
  if (!fresh.length) return;
  cache = [...(cache ?? []), ...fresh];
  if (hasIndexedDB()) await idbPut(fresh);
  else lsWrite(cache);
  notify();
}

/** Dev/test helper: wipe the in-memory view (does not touch IndexedDB). */
export function _resetForTest(): void {
  cache = null;
  seqCounter = 0;
  seenIds.clear();
}
