-- Proof CMMS — Auth + RLS (brief 12), enforcing the brief-02 permission matrix
-- at the database. Security lives here, never UI-only. Assume a hostile client.
--
-- Matrix (capability → roles), used as the policy test fixture:
--   see district contracts ........ Documentation, DistrictAdmin
--   see assigned/own contracts .... all (via user_districts / user_contract_access)
--   create sample / test id ....... Inspector, ResidentEngineer, DistrictAdmin
--   enter/validate tests .......... Inspector, DistrictAdmin
--   create/fill inventory+ledger .. Inspector, ResidentEngineer, DistrictAdmin
--   assign pay items .............. ResidentEngineer, DistrictAdmin
--   set inventory Ready for Review  Inspector, ResidentEngineer, Documentation, DistrictAdmin
--   approve/reject EOI ............ Documentation, DistrictAdmin
--   set Pay Item Material Status .. Documentation, DistrictAdmin
--   bulk Mark Review Complete ..... Documentation, DistrictAdmin
--   manage users/roles/setup ...... DistrictAdmin

-- --- identity / role / scope tables ---------------------------------------
create table if not exists districts (
  id    int primary key,
  name  text not null
);

create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists user_roles (
  user_id  uuid not null references users(id) on delete cascade,
  role     text not null,   -- Inspector | ResidentEngineer | Contractor | Documentation | DistrictAdmin
  primary key (user_id, role)
);

create table if not exists user_districts (
  user_id      uuid not null references users(id) on delete cascade,
  district_id  int not null,
  primary key (user_id, district_id)
);

create table if not exists user_contract_access (
  user_id      uuid not null references users(id) on delete cascade,
  contract_id  text not null references contracts(id) on delete cascade,
  primary key (user_id, contract_id)
);

-- --- helper functions (stable, security definer where they read scope) -----
create or replace function has_role(r text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r);
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select has_role('DistrictAdmin');
$$;

create or replace function is_documentation() returns boolean
  language sql stable security definer set search_path = public as $$
  select has_role('Documentation') or has_role('DistrictAdmin');
$$;

create or replace function can_see_contract(cid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from contracts c
    where c.id = cid and (
      c.district = any (select district_id from user_districts where user_id = auth.uid())
      or c.id in (select contract_id from user_contract_access where user_id = auth.uid())
    )
  );
$$;

create or replace function can_see_item(iid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select can_see_contract((select contract_id from inventory_items where id = iid));
$$;

create or replace function can_see_sample(sid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select can_see_contract((select contract_id from samples where id = sid));
$$;

-- --- enable RLS -----------------------------------------------------------
alter table districts             enable row level security;
alter table users                 enable row level security;
alter table user_roles            enable row level security;
alter table user_districts        enable row level security;
alter table user_contract_access  enable row level security;
alter table quantity_ledgers      enable row level security;
alter table eoi_entries           enable row level security;
alter table pay_item_materials    enable row level security;
alter table placements            enable row level security;
alter table pay_estimates         enable row level security;
alter table authorizations        enable row level security;
alter table samples               enable row level security;
alter table tests                 enable row level security;
alter table diary_days            enable row level security;
alter table diary_suspensions     enable row level security;
alter table mix_designs           enable row level security;
alter table documents             enable row level security;

-- identity tables: a user reads their own rows; admin manages all.
create policy users_self on users for select using (id = auth.uid() or is_admin());
create policy users_admin on users for all using (is_admin()) with check (is_admin());
create policy roles_self on user_roles for select using (user_id = auth.uid() or is_admin());
create policy roles_admin on user_roles for all using (is_admin()) with check (is_admin());
create policy ud_self on user_districts for select using (user_id = auth.uid() or is_admin());
create policy ud_admin on user_districts for all using (is_admin()) with check (is_admin());
create policy uca_self on user_contract_access for select using (user_id = auth.uid() or is_admin());
create policy uca_admin on user_contract_access for all using (is_admin()) with check (is_admin());
create policy districts_read on districts for select using (true);
create policy districts_admin on districts for all using (is_admin()) with check (is_admin());

-- contracts + summary children: visibility by scope.
drop policy if exists "demo read contracts" on contracts;
create policy contracts_scoped on contracts for select using (can_see_contract(id));

drop policy if exists "demo read pay_items" on pay_items;
create policy pay_items_read on pay_items for select using (can_see_contract(contract_id));
-- RE/Admin author pay items (authorization propagation + assignment).
create policy pay_items_write on pay_items for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

-- inventory: visibility scoped; authoring roles write; Review Complete is doc-only.
drop policy if exists "demo read inventory" on inventory_items;
drop policy if exists "demo write inventory" on inventory_items;
create policy inventory_read on inventory_items for select using (can_see_contract(contract_id));
create policy inventory_insert on inventory_items for insert
  with check (can_see_contract(contract_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_admin()));
create policy inventory_update on inventory_items for update
  using (can_see_contract(contract_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_documentation()))
  with check (
    can_see_contract(contract_id)
    and (status <> 'Review Complete' or is_documentation())  -- bulk Mark Review Complete is documentation-only
  );

-- EOI rows: structure by authoring roles; approval audited in eoi_reviews (doc-only).
drop policy if exists "demo read eoi" on eoi_reviews;
drop policy if exists "demo write eoi" on eoi_reviews;
create policy eoi_reviews_read on eoi_reviews for select using (can_see_item(item_id));
create policy eoi_reviews_write on eoi_reviews for all
  using (can_see_item(item_id) and is_documentation())
  with check (can_see_item(item_id) and is_documentation());

create policy eoi_entries_read on eoi_entries for select using (can_see_item(item_id));
create policy eoi_entries_write on eoi_entries for all
  using (can_see_item(item_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_admin()))
  with check (can_see_item(item_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_admin()));

create policy ledger_read on quantity_ledgers for select using (can_see_item(item_id));
create policy ledger_write on quantity_ledgers for all
  using (can_see_item(item_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_admin()))
  with check (can_see_item(item_id) and (has_role('Inspector') or has_role('ResidentEngineer') or is_admin()));

-- Pay Item Material Status: documentation-only.
create policy pim_read on pay_item_materials for select using (can_see_item(item_id));
create policy pim_write on pay_item_materials for all
  using (can_see_item(item_id) and is_documentation())
  with check (can_see_item(item_id) and is_documentation());

-- Quantity Book + Pay Estimate + Authorizations: RE/Admin author, scope read.
create policy placements_read on placements for select using (can_see_contract(contract_id));
create policy placements_write on placements for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

create policy payest_read on pay_estimates for select using (can_see_contract(contract_id));
create policy payest_write on pay_estimates for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

create policy auth_read on authorizations for select using (can_see_contract(contract_id));
create policy auth_write on authorizations for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

-- Samples + tests.
create policy samples_read on samples for select
  using (contract_id is null or can_see_contract(contract_id));
create policy samples_write on samples for all
  using ((contract_id is null or can_see_contract(contract_id)) and (has_role('Inspector') or has_role('ResidentEngineer') or is_documentation()))
  with check ((contract_id is null or can_see_contract(contract_id)) and (has_role('Inspector') or has_role('ResidentEngineer') or is_documentation()));
create policy tests_read on tests for select using (can_see_sample(sample_id));
create policy tests_write on tests for all
  using (can_see_sample(sample_id) and (has_role('Inspector') or is_admin()))
  with check (can_see_sample(sample_id) and (has_role('Inspector') or is_admin()));

-- Diary: scope read; RE/Admin author. Contractor must NOT read Project Logs /
-- internal notes — contractors read only signed days via the view below.
create policy diary_read on diary_days for select
  using (can_see_contract(contract_id) and not has_role('Contractor'));
create policy diary_write on diary_days for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));
create policy susp_read on diary_suspensions for select using (can_see_contract(contract_id));
create policy susp_write on diary_suspensions for all
  using (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (can_see_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

-- Signed-diary view contractors may read (no project_log, signed only).
create or replace view diary_contractor_view
  with (security_invoker = true) as
  select contract_id, date, weather, controlling_item, contractor_work, signed_by, signed_at
  from diary_days
  where signed_by is not null and can_see_contract(contract_id);

-- Reference data: readable by any authenticated user; admin writes.
create policy mix_read on mix_designs for select using (auth.role() = 'authenticated');
create policy mix_admin on mix_designs for all using (is_admin()) with check (is_admin());

-- Documents (file metadata): scope read; authoring roles add.
create policy docs_read on documents for select using (contract_id is null or can_see_contract(contract_id));
create policy docs_write on documents for all
  using ((contract_id is null or can_see_contract(contract_id)) and not has_role('Contractor'))
  with check ((contract_id is null or can_see_contract(contract_id)) and not has_role('Contractor'));

-- --- Storage buckets (run once; objects enforced by Storage policies) ------
-- insert into storage.buckets (id, name, public) values
--   ('eoi-certs','eoi-certs',false), ('project-docs','project-docs',false),
--   ('auth-attachments','auth-attachments',false), ('mix-designs','mix-designs',false),
--   ('sample-docs','sample-docs',false) on conflict do nothing;
-- Storage RLS: scope each object path by contract id and reuse can_see_contract().
