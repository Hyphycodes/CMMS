# PLAN — Proof (a faster CMMS companion)

Rebuild the slow parts of IDOT's CMMS as a fast, modern web app that keeps the **exact
same workflow and every data field** from the training manual, but never makes the user
wait on a click. Ship the two screens that hurt most first: the **Inventory list** and a
**cross-contract approval inbox**.

The manual (`CMMS_Training_Manual_23-12-27.pdf`) is the source of truth for *what exists*.
Authoritative field lists / statuses extracted from Ch. 2, 8, 9, 10–12, 14.

## Architecture (the unlock)

- **Load once, work in the browser, save only deltas.** A contract's data is pulled a
  single time; all filtering / sorting / expanding / tab-switching happens in memory.
  The backend is hit only to *save* a change.
- **Virtualize every large grid** (TanStack Virtual) — 50 rows and 50,000 rows feel identical.
- **Optimistic mutations** — a status change flips the UI instantly; the save fires in the
  background and silently rolls back + toasts on failure.
- **No pagination** — one virtualized list with type-to-filter.
- **`dataSource` seam** — a thin interface (`src/data/dataSource.ts`) so a real CMMS export
  (CSV) or API can be dropped in later without touching the UI. Default impl is in-browser
  (`localDataSource`, deterministic seed + localStorage deltas, zero setup); a
  `supabaseDataSource` + schema/seed script ship ready to wire.

## Stack

React 19 + Vite + TypeScript · TanStack Table / Virtual / Query · React Router (URL state) ·
Zustand (optimistic working set) · Tailwind v4 · Supabase (optional backend) · Vercel-ready.

## Status model (from Ch. 14 — never invent)

| Set | Values |
| --- | --- |
| Inventory | Needs Attention · Ready for Review · Review Complete |
| EOI | Approved · Approved as Exception · Rejected |
| Pay Item Materials | Approved · Approved as Exception · Deficient |
| Group | Satisfactory · Deficient |

## Build order (Phase 1 is the must-hit; everything after is bonus)

### Phase 0 — Scaffold + data ✅
Vite/React/TS, Tailwind, domain types, reference data, deterministic seed, `dataSource`
interface + local impl, Supabase schema + seed script, app shell (header, contract
selector, left tree). App runs; the tree navigates.

### Phase 1 — Two hero screens (MUST HIT)
**(a) Inventory list** — virtualized grid with the full Ch.8 column set, status pills,
code+name pairing, instant search/filter/sort, multi-select, right-click actions, and an
inventory item detail with the four tabs (Details, Quantity Ledger, EOI, Pay Item
Materials) — all fields present, EOI rows individually approvable.

**(b) My Work Tasks approval inbox** (cross-contract headliner) — one virtualized list of
everything **Ready for Review** across all projects, **oldest waiting first**, checkbox
multi-select, **bulk "Mark Review Complete"** (optimistic), one-shot **bulk note**, and a
**duplicate-collapse ("LA-15")** affordance that detects same material+producer+supplier
and lets the user merge/clear them together before approving.

**DoD:** land in the inbox, filter to a producer/material, select 300 items, approve in one
action, watch them clear instantly — on 8,000+ rows with zero lag.

### Phase 2 — Contract Summary tab (progressive disclosure)
Rebuild the Ch.2 Summary with **every field preserved**, grouped into cards (Contract Info,
Dates/Key Info, Values, Work Type, Time Spec). Show the edited handful; collapse secondary
cards and hide empty fields until editing. Nothing removed — just calmer.

### Phase 3 — Samples + tests (stretch)
Sample list + create, test entry with multi-select "execute tests," validate → approve
lifecycle (Ch.10–12 status sets). Built as far as time allows; left clean and runnable.

## Performance acceptance

8,000+ row grids at ~60fps; filter/sort/expand within one frame; instant status change with
background save; no full-page reloads or blocking spinners; dev-only row-count switcher
(1k / 10k / 50k) on the inventory grid, hidden behind a flag for "prod."
