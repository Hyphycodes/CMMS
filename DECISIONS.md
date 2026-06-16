# DECISIONS

Choices made autonomously during the overnight build. When the prompt/manual was
ambiguous, I picked the simplest reasonable option that keeps the app runnable, and logged
it here.

### D1 — Build location: `~/Desktop/CMMS`
An empty `CMMS/` folder was pre-created on the Desktop; built there as a standalone git
repo (separate from the unrelated `Flowmind` project next to it). The manual PDF is copied
to the repo root as the prompt requests.

### D2 — Default data source is in-browser `localDataSource`, not Supabase
The prompt names Supabase as the backend but also demands the app be **runnable on wake
with zero setup** and that performance be **demonstrable immediately on 8,000+ rows**.
Requiring live Supabase credentials would break "it just runs." Resolution: the `dataSource`
interface has two implementations —
- `localDataSource` (default): generates the full deterministic seed in-browser, holds it
  in memory, persists status deltas to `localStorage`, and simulates network latency on
  saves so the optimistic UI is real and visible.
- `supabaseDataSource`: reads/writes via Supabase, selected with `VITE_DATA_SOURCE=supabase`.
The Supabase **schema migration + re-runnable seed script** ship in `supabase/` + `scripts/`
so the backend can be wired without touching the UI. This honors the `dataSource` seam the
prompt explicitly asked for.

### D3 — Codename kept as "Proof"
Per the prompt's suggestion (materials get *proven* against spec). Trivial to rename
(`package.json` name + header label).

### D4 — Reference data is real-from-manual + synthetic, never sensitive
Material codes, producers, suppliers, pay items, EOI/MOA codes are taken verbatim from the
manual's public examples (19522R, 40458, 40459, 21605, 65501, 041CA06, 75000, 6291860;
SWARCO, Advance Asphalt, Roanoke Concrete, CMC/Nucor/Gerdau steel; TICK/TEST/DPR/LA-15/…)
and extended with synthetic-but-plausible entries to reach scale. **No real people**;
resident/reviewer names are synthetic.

### D5 — Tree scope matches the prompt's six nodes
Left tree = Contract, Diary, Quantity Book, Inventory, Pay Estimate, Authorizations (the
manual also has Material Allowance — folded under Quantity Book context, not a separate
top node, to match the prompt's list). Only Contract (Summary) and Inventory are
interactive in this build; the rest are present, navigable, and clearly marked as
out-of-scope stubs (no fake buttons).

### D6 — Quantity Ledger description columns are generic Desc 1/2/3 with material-aware labels
The manual shows material-specific description columns (e.g. Rebar Size, Rebar/Steel
Producer Number for rebar; blank for most HMA). Modeled as three optional `desc1/2/3`
fields plus a per-material-family label map, so no field is lost and labels stay faithful.

### D7 — Row-count switcher (1k/10k/50k) is gated behind a dev flag
Visible in dev (`import.meta.env.DEV`) or with `?perf=1`; hidden in prod builds, per the
performance-acceptance section.

### D8 — Pay Item "material quantity required" uses the manual's preset-conversion-factor model
Balance = provided − required, where required = pay quantity placed × material conversion
factor (preset per material family; e.g. HMA 0.672 as in the manual). Group Status is
derived (Satisfactory when balance ≥ 0, else Deficient), exactly as the manual describes.
