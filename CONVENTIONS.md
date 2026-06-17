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
- Grouping/balance/money math lives once (`src/domain/grouping.ts` + `src/domain/money.ts`)
  and is shared by inventory + quantity book + pay estimate — they must never disagree.
- Material unit ≠ pay-item unit — always surface both.
- Optimistic UI must roll back cleanly. Prove it: open with `?chaos=0.5` (local mode forces
  ~50% of saves to fail → the UI rolls back + toasts).

## 6. Performance & accessibility invariants (brief 13)
Every module inherits these from the shared components — don't re-litigate them:
- **Virtualize** at > ~100 rows via `DataGrid` (TanStack Virtual). 50 rows and 50,000 feel
  identical. The dev row-count switcher (`?perf=1`) proves it on inventory.
- **Optimistic** writes through the store + `DataSource`; instant flip, background save,
  rollback + `aria-live` toast on failure.
- **Scoped load** (brief 02/12): `loadWorld` returns only the user's world; with Supabase,
  RLS returns only permitted rows, so the in-memory model stays small.
- **a11y:** base type ≥ 15px, data ≥ 13px tabular; visible focus rings; rows are keyboard
  focusable (Enter opens); **Esc** closes the drawer; labeled (never icon-only) primary
  actions; disabled controls keep a tooltip reason; empty states say "No records to display."
