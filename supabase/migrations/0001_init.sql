-- Proof CMMS — initial schema.
-- Mirrors the domain model (src/domain/types.ts). The app runs fully on the
-- in-browser local data source; this schema is for when you wire the Supabase
-- backend (VITE_DATA_SOURCE=supabase). Apply, then run `npm run seed:supabase`.

create table if not exists contracts (
  id                       text primary key,
  number                   text not null,
  name                     text not null,
  county                   text not null,
  district                 int  not null,
  work_type                text not null,
  inventory_count          int  not null default 0,
  ready_for_review_count   int  not null default 0,
  summary                  jsonb not null default '{}'::jsonb
);

create table if not exists pay_items (
  contract_id      text not null references contracts(id) on delete cascade,
  number           text not null,
  description      text not null,
  unit             text not null,
  unit_price       numeric not null default 0,
  awarded_quantity numeric not null default 0,
  placed_quantity  numeric not null default 0,
  primary key (contract_id, number)
);

create table if not exists inventory_items (
  id                text primary key,
  inventory_id      text not null,
  contract_id       text not null references contracts(id) on delete cascade,
  contract_number   text not null,
  material_code     text not null,
  material_name     text not null,
  material_unit     text not null,
  producer_number   text not null,
  producer_name     text not null,
  supplier_number   text not null,
  supplier_name     text not null,
  status            text not null,             -- Needs Attention | Ready for Review | Review Complete
  note              text not null default '',
  pay_item_numbers  text[] not null default '{}',
  ready_at          timestamptz
);

-- The two hottest access paths: per-contract listing and the cross-contract inbox.
create index if not exists inventory_items_contract_idx on inventory_items (contract_id);
create index if not exists inventory_items_status_idx   on inventory_items (status);
create index if not exists inventory_items_ready_at_idx on inventory_items (ready_at)
  where status = 'Ready for Review';

-- EOI per-row approvals (Ch. 14). Inventory status/note persist as columns above.
create table if not exists eoi_reviews (
  item_id   text not null references inventory_items(id) on delete cascade,
  eoi_id    text not null,
  approval  text not null,                     -- Approved | Approved as Exception | Rejected | Unset
  note      text not null default '',
  primary key (item_id, eoi_id)
);

-- RLS — DEMO posture. This data set is generic and non-sensitive (no real
-- people). For the public demo we allow the anon role to read and to write the
-- review deltas. Tighten to owner-scoped policies before using real data.
alter table contracts        enable row level security;
alter table pay_items        enable row level security;
alter table inventory_items  enable row level security;
alter table eoi_reviews      enable row level security;

create policy "demo read contracts"   on contracts       for select using (true);
create policy "demo read pay_items"    on pay_items       for select using (true);
create policy "demo read inventory"    on inventory_items for select using (true);
create policy "demo write inventory"   on inventory_items for update using (true) with check (true);
create policy "demo read eoi"          on eoi_reviews     for select using (true);
create policy "demo write eoi"         on eoi_reviews     for all    using (true) with check (true);
