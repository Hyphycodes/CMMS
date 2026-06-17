# Module conventions (read before adding a feature)

Every module in Proof follows the same shape. The spine is in `src/store/store.ts`,
`src/data/dataSource.ts`, and `src/data/seed/generate.ts`. Don't fork it.

## 1. Load once, work in memory, persist only deltas
`store.load()` calls `getDataSource().loadWorld(...)` exactly once and fills the
in-memory `World`. **Every read is a synchronous Zustand selector** (`contract`,
`inventoryForContract`, `samples`, `detail`, …). Never fetch on navigation; the working
set is already in memory. Do not add React Query for data the world already serves.

## 2. New entity
1. Add the type to `src/domain/types.ts` (verbatim legacy field names + statuses).
2. Generate it deterministically in `src/data/seed/generate.ts` using `makeRng(seed)`
   and the existing reference data — the seed must be identical on every load.
3. Expose a **selector** on the store (scoped by the current user — see roles).

## 3. New write (the only way data changes)
1. Add a method to the `DataSource` interface (`src/data/dataSource.ts`).
2. Implement it in **both** sources: `sources/local.ts` (localStorage delta +
   `latency()` + `maybeFail()`) and `sources/supabase.ts`.
3. Add an **optimistic store mutation** modeled exactly on `setEoiApproval` /
   `setInventoryStatus`: apply to memory immediately, call
   `persist(get, set, run, rollback, failMessage)`, roll back + toast on failure.
4. Gate it with `can(user, capability, ctx)` (see `src/auth/permissions.ts`).

## 4. Shared UI (build on these, never re-implement)
- `DataGrid` — virtualized (> ~100 rows), sortable, multi-select, optional toolbar.
- `DetailDrawer` + `TabBar` — record detail slide-over.
- `IntelligentSearch` — the one columned typeahead for every code/vendor/pay-item picker.
- `EditableRowTable` (+ `EditText/EditNumber/EditDate/EditSelect/EditChips`) — inline editors.
- `FieldGroup` — collapsible card with show-empty.
- `Pill` + `src/domain/status.ts` tones — never invent a status or a color.

## 5. Guardrails
- One store, one router, **no pagination** — virtualize, don't truncate.
- Grouping/balance/money math lives once (`src/domain/grouping.ts`) and is shared by
  inventory + quantity book — they must never disagree.
- Material unit ≠ pay-item unit — always surface both.
- Optimistic UI must roll back cleanly (`setChaos(p)` in local mode proves it).
