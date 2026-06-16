# Good morning — here's what got built

**Proof** — a fast, modern rebuild of the slow parts of IDOT's CMMS. Same workflow, every
field from the manual, but nothing waits on a click. It runs with **zero setup** and is
seeded so the speed is demonstrable immediately (~200 contracts, ~8,000 inventory items,
~1,200 in *Ready for Review*).

I verified the whole thing in a real browser — screenshots of the inbox, the bulk-approve
flow, the inventory grid, the four-tab item detail, the contract summary, and the 50k-row
performance test are in the build log. Typecheck, lint, and production build all pass.

## 1. How to run it

```bash
cd ~/Desktop/CMMS
npm install
npm run dev          # open http://localhost:5173
```

No backend, no API keys. To reset the demo to the full backlog at any time, clear the
`proof:deltas:v1` key in localStorage (or run in the console:
`localStorage.removeItem('proof:deltas:v1')`).

Other commands: `npm run build`, `npm run typecheck`, `npm run lint`,
`npx tsx scripts/check-seed.ts` (prints the seed counts).

## 2. What's done vs. stubbed, by phase

**Phase 0 — Scaffold + data — DONE.** Vite/React/TS + Tailwind v4, the domain model from
the manual, real-from-manual reference data (codes 19522R/40458/21605/…, SWARCO/Advance
Asphalt/CMC Steel/…), a deterministic seed engine, the `dataSource` interface with a local
impl, a Supabase schema + re-runnable seed script, and the app shell (header, contract
selector, left tree: Contract · Diary · Quantity Book · Inventory · Pay Estimate ·
Authorizations).

**Phase 1 — The two hero screens — DONE (the must-hit).**
- **Inventory list** — virtualized grid with the full Ch. 8 column set (Inventory ID,
  Material *code + name*, Producer #/name, Supplier #/name, Inventory Status pill, Pay
  Items, Note), instant search/sort/filter, status facets with live counts, multi-select
  with a bulk action bar, **right-click context actions**, and a dev **Perf** switcher
  (1k/10k/50k). The item detail has all four tabs — **Details** (every field), **Quantity
  Ledger**, **Evidence of Inspection** (each row individually Approved / Approved as
  Exception / Rejected, with required reason notes), and **Pay Item Materials**
  (provided vs. required, balance, group status — the manual's conversion-factor math).
- **My Work Tasks inbox** — one virtualized list of everything *Ready for Review* across
  all contracts, **oldest waiting first**, with producer/material filters, type-to-filter
  search, checkbox multi-select (+ shift-range, select-all), a **bulk "Mark Review
  Complete"** that applies optimistically, a **one-shot bulk note**, and **duplicate
  collapse** (same material+producer+supplier folds into a cluster you can expand and
  "Approve all" together — the "LA-15" affordance).
  - **DoD met:** I filtered to *Advance Asphalt* (180 items across 100 contracts), selected
    all, hit Mark Review Complete once, and watched them clear instantly while the save ran
    in the background — on the 8,000-item world with zero lag.

**Phase 2 — Contract Summary — DONE.** The Ch. 2 Summary rebuilt with **every field
preserved**, grouped into five cards (Contract Info, Dates/Key Info, Values, Work Type,
Time Spec). A key-fields strip shows the handful people watch; secondary cards are
collapsed and **empty fields are hidden** until you flip "Show empty fields."

**Phase 3 — Samples + tests — STUBBED (stretch).** The Diary / Quantity Book / Pay Estimate
/ Authorizations tree nodes render a clear "not in this build" page (no fake buttons). The
sample/test lifecycle (Ch. 10–12) is the natural next slice — the data model and statuses
are already defined for it.

## 3. Decisions I made (and why)

Logged in [DECISIONS.md](DECISIONS.md). The big one: **the default data source is the
in-browser `localDataSource`, not Supabase** — so the app runs on wake with zero setup and
the 8,000-row speed is demonstrable immediately. Supabase ships fully wired (schema + seed
script + `supabaseDataSource`) behind `VITE_DATA_SOURCE=supabase`. Other notable calls:
build location (`~/Desktop/CMMS`), reference data is real-from-manual + synthetic (no real
people), the row-count switcher is dev-gated, and the pay-item balance uses the manual's
preset conversion-factor model.

## 4. Where the `dataSource` seam is

[`src/data/dataSource.ts`](src/data/dataSource.ts) defines the whole contract the UI
depends on (`loadWorld`, `persistInventoryStatus`, `persistInventoryNote`,
`persistEoiApproval`). To wire a real CMMS **CSV export or API**, add a third file under
`src/data/sources/` implementing that interface and select it in `getDataSource()`. The UI,
the store, and every screen stay untouched — they only know the interface. The Supabase
implementation in [`src/data/sources/supabase.ts`](src/data/sources/supabase.ts) is the
worked example, and [`scripts/seed-supabase.ts`](scripts/seed-supabase.ts) shows the row
mapping.

## 5. The 3 things I'd do next

1. **Build Phase 3 (Samples + Testing, Ch. 10–12).** Sample list + create, multi-select
   "execute tests," and the validate → approve lifecycle that produces the Test IDs the EOI
   tab already references — closing the loop from inventory to lab.
2. **Make the inventory grid's bulk actions and EOI approvals first-class in the inbox
   detail.** Today the inbox opens an item's detail in its contract; I'd add inline EOI
   approval from the inbox row so a reviewer never leaves the queue, and a keyboard triage
   mode (j/k to move, space to select, ⌘↵ to approve).
3. **Wire the real CMMS export through the seam.** Implement a `csvDataSource` that ingests
   an actual IDOT inventory export, with a column-mapping step — turning the demo into a
   drop-in faster front-end over real data without touching any screen.
