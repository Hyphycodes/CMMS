-- Proof CMMS — module tables (briefs 03–11).
-- Extends 0001_init.sql. Enums match src/domain/types.ts constants verbatim.
-- Apply after 0001, then run `npm run seed:supabase`.

-- --- enums (UI-matching) ---------------------------------------------------
do $$ begin
  create type sample_status as enum ('Logged In','In Testing','Tested','Validated','Approved','Rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type eoi_approval as enum ('Unset','Approved','Approved as Exception','Rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pay_item_material_status as enum ('Approved','Approved as Exception','Deficient');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ledger_type as enum ('Received','Tested','Adjustment');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pay_estimate_status as enum ('Draft','Submitted','Approved','Paid');
exception when duplicate_object then null; end $$;
do $$ begin
  create type auth_type as enum ('Standard','Overage/Balancing','Major Change');
exception when duplicate_object then null; end $$;
do $$ begin
  create type auth_status as enum ('Draft','In Approval','Published');
exception when duplicate_object then null; end $$;

-- --- pay_items: brief 08 additions ----------------------------------------
alter table pay_items add column if not exists fund_key text;
alter table pay_items add column if not exists final boolean not null default false;

-- --- Quantity Ledger (brief 05) -------------------------------------------
create table if not exists quantity_ledgers (
  item_id          text not null references inventory_items(id) on delete cascade,
  id               int  not null,                 -- per-item row id
  date             date,
  pay_item_number  text,
  desc1            text not null default '',
  desc2            text not null default '',
  desc3            text not null default '',
  mix_design       text not null default '',
  batch_lot_heat   text not null default '',
  type             ledger_type not null default 'Received',
  transaction_qty  numeric not null default 0,
  created_at       timestamptz not null default now(),
  primary key (item_id, id)
);

-- --- Evidence of Inspection rows (brief 05) -------------------------------
create table if not exists eoi_entries (
  id            text primary key,
  item_id       text not null references inventory_items(id) on delete cascade,
  ledger_ids    int[] not null default '{}',
  actual_eoi    text[] not null default '{}',
  actual_moa    text[] not null default '{}',
  test_id       text not null default '',
  approval      eoi_approval not null default 'Unset',
  note          text not null default '',
  has_document  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists eoi_entries_item_idx on eoi_entries (item_id);

-- --- Pay Item Material status overrides (brief 05) ------------------------
create table if not exists pay_item_materials (
  item_id          text not null references inventory_items(id) on delete cascade,
  pay_item_number  text not null,
  status           pay_item_material_status not null,
  note             text not null default '',
  created_by       text,
  created_at       timestamptz not null default now(),
  primary key (item_id, pay_item_number)
);

-- --- Placements (brief 08) ------------------------------------------------
create table if not exists placements (
  id               text primary key,
  contract_id      text not null references contracts(id) on delete cascade,
  pay_item_number  text not null,
  date             date,
  fund_key         text,
  type             text not null default 'Placed',  -- Placed | Adjustment
  quantity         numeric not null default 0,
  price            numeric not null default 0,
  location         text not null default '',
  contractor       text not null default '',
  posted           boolean not null default false,
  pay_estimate_id  text,
  creator          text,
  created_at       timestamptz not null default now()
);
create index if not exists placements_contract_idx on placements (contract_id, pay_item_number);

-- --- Pay Estimates (brief 09) ---------------------------------------------
create table if not exists pay_estimates (
  id                  text primary key,
  contract_id         text not null references contracts(id) on delete cascade,
  number              int not null,
  period_start        date,
  period_end          date,
  status              pay_estimate_status not null default 'Draft',
  submitted_by        text,
  submitted_at        date,
  lines               jsonb not null default '[]'::jsonb,
  this_estimate_total numeric not null default 0,
  to_date_total       numeric not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists pay_estimates_contract_idx on pay_estimates (contract_id);

-- --- Authorizations (brief 10) --------------------------------------------
create table if not exists authorizations (
  id             text primary key,
  contract_id    text not null references contracts(id) on delete cascade,
  number         int not null,
  type           auth_type not null default 'Standard',
  description    text not null default '',
  net_change     numeric not null default 0,
  status         auth_status not null default 'Draft',
  created_date   date,
  items          jsonb not null default '[]'::jsonb,
  approvals      jsonb not null default '[]'::jsonb,
  has_attachment boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists authorizations_contract_idx on authorizations (contract_id);

-- --- Samples + Tests (briefs 03–04) ---------------------------------------
create table if not exists samples (
  id                 text primary key,
  sample_identifier  text not null,
  test_id            text not null,
  inspection_type    text,
  inspector          text,
  sample_date        date,
  total_samples      int not null default 1,
  material_code      text,
  material_name      text,
  desc1              text not null default '',
  desc2              text not null default '',
  desc3              text not null default '',
  special_id         text not null default '',
  inspected_qty      numeric not null default 0,
  material_unit      text,
  producer_number    text,
  producer_name      text,
  supplier_number    text,
  supplier_name      text,
  sampled_from       text,
  latitude           text,
  longitude          text,
  spec_year          text,
  dsa_baba           boolean not null default false,
  responsible_lab    text,
  contract_id        text references contracts(id) on delete set null,
  pay_item_number    text,
  inventory_item_id  text references inventory_items(id) on delete set null,
  received_date      date,
  started_date       date,
  completed_date     date,
  status             sample_status not null default 'Logged In',
  approver_name      text not null default '',
  approved_date      date,
  note               text not null default '',
  has_document       boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists samples_status_idx on samples (status);
create index if not exists samples_contract_idx on samples (contract_id);

create table if not exists tests (
  id            text primary key,
  sample_id     text not null references samples(id) on delete cascade,
  series        int not null default 1,
  test_type     text,
  tested_by     text,
  test_date     date,
  fields        jsonb not null default '[]'::jsonb,
  validated     boolean not null default false,
  validated_by  text not null default '',
  validated_at  date,
  created_at    timestamptz not null default now()
);
create index if not exists tests_sample_idx on tests (sample_id);

-- --- Diary (brief 07) -----------------------------------------------------
create table if not exists diary_days (
  contract_id      text not null references contracts(id) on delete cascade,
  date             date not null,
  weather          jsonb not null default '{}'::jsonb,
  controlling_item text not null default '',
  contractor_work  jsonb not null default '[]'::jsonb,
  project_log      text not null default '',
  signed_by        text,
  signed_at        date,
  created_at       timestamptz not null default now(),
  primary key (contract_id, date)
);
create table if not exists diary_suspensions (
  id           bigint generated by default as identity primary key,
  contract_id  text not null references contracts(id) on delete cascade,
  from_date    date not null,
  to_date      date,
  reason       text not null default ''
);

-- --- Mix designs (brief 11) -----------------------------------------------
create table if not exists mix_designs (
  number         text primary key,
  material_code  text,
  family         text,
  producer       text,
  approved       boolean not null default false,
  doc_url        text
);

-- --- Documents (file metadata; storage objects live in Storage) -----------
create table if not exists documents (
  id           text primary key,
  contract_id  text references contracts(id) on delete cascade,
  kind         text not null,            -- eoi_cert | project_doc | auth_attach | mix_design | sample_label
  name         text not null,
  bucket       text not null,
  path         text not null,            -- storage object path
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists documents_contract_idx on documents (contract_id);
