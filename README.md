# Proof — a faster CMMS companion

A modern rebuild of the slow parts of IDOT's CMMS. **Same workflow, every data
field** from the training manual — but it never makes you wait on a click.

The two screens that hurt most, shipped first:

- **Inventory list** (per contract) — the full Ch. 8 grid, virtualized, with instant
  search/sort/filter, multi-select, right-click actions, and a four-tab item detail.
- **My Work Tasks** — a cross-contract approval inbox of everything *Ready for Review*,
  oldest first, with bulk approve, a one-shot bulk note, and duplicate-collapse.

…then the rest of the workflow, on the same spine (briefs 01–13): **roles & scoped,
role-aware landing** · **Samples + Tests** · writable **Inventory** (ledger / EOI / create) ·
**Contract** Insurance / Documents / Subcontracting / Final Review · **Diary** ·
**Quantity Book** · **Pay Estimate** · **Authorizations** · **Materials** admin · a real
Supabase backend with **Auth + RLS** · and a performance / accessibility pass. Read
[CONVENTIONS.md](CONVENTIONS.md) before adding a module.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

That's it — no backend or keys required. The app generates a deterministic seed in the
browser (~200 contracts, ~8,000 inventory items, ~1,200 ready for review) and persists
your changes to `localStorage`.

Other commands:

```bash
npm run build        # production build (also runs tsc)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npx tsx scripts/check-seed.ts   # sanity-check the seed counts
```

## The architecture (why it's fast)

- **Load once, work in the browser, save only deltas.** The world is pulled a single
  time; all filtering / sorting / expanding / tab-switching happens in memory. The backend
  is hit only to *save* a change.
- **Virtualized grids** (TanStack Virtual) — 50 rows and 50,000 rows render identically
  (~27 row nodes on screen at any time). Toggle the dev **Perf** switcher (1k/10k/50k) on
  the Inventory grid to feel it.
- **Optimistic mutations** — a status change flips the UI instantly; the save fires in the
  background and silently rolls back + toasts on failure.
- **No pagination** — one virtualized list with type-to-filter.

## The `dataSource` seam

The UI only ever talks to [`src/data/dataSource.ts`](src/data/dataSource.ts). Two
implementations ship:

- `sources/local.ts` — default, in-browser deterministic seed + localStorage deltas.
- `sources/supabase.ts` — set `VITE_DATA_SOURCE=supabase` (+ `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`).

To wire the backend, apply the migrations in order, then seed:

```bash
# in the Supabase SQL editor or CLI, apply in order:
#   supabase/migrations/0001_init.sql     contracts, pay_items, inventory_items, eoi_reviews
#   supabase/migrations/0002_modules.sql  samples/tests/ledger/eoi/placements/estimates/auth/diary/mix/docs (+ enums, indexes)
#   supabase/migrations/0003_auth_rls.sql users/roles/districts + RLS for the role matrix
npm run seed:supabase                 # push the deterministic world to the DB
npm run import -- contracts.csv       # OR: dry-run import real data (add --commit to write)
```

Env vars (`.env.local`): `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
(client) and `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, for the scripts).
A real CMMS CSV export or API becomes a third implementation of the same interface —
no UI changes.

## Stack

React 19 · Vite · TypeScript · TanStack Table / Virtual / Query · React Router · Zustand ·
Tailwind v4 · Supabase (optional) · Vercel-ready.

See [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), and [SUMMARY.md](SUMMARY.md).
