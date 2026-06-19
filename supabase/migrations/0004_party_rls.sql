-- Proof CMMS — P5: RLS as the real wall, with the PARTY dimension (F2).
--
-- The personal "my projects" lens (P1) is a convenience default, NOT security.
-- Security lives here: a non-IDOT party (Contractor / Producer / Lab) must be
-- *unable to load* another party's contract — zero rows from the database, not a
-- filtered client list. IDOT roles are unaffected (they keep district/assignment
-- scope from 0003). This file layers party scoping onto the 0003 helpers.

-- --- party dimension on identity + contracts -------------------------------
alter table users add column if not exists org_id text not null default 'IDOT';
alter table users add column if not exists party text not null default 'IDOT';
  -- party ∈ IDOT | Contractor | Producer | Supplier | Lab

-- Which external orgs are party to a contract (empty ⇒ IDOT-only contract).
create table if not exists contract_parties (
  contract_id text not null references contracts(id) on delete cascade,
  org_id      text not null,
  party       text not null,
  primary key (contract_id, org_id)
);
alter table contract_parties enable row level security;

-- --- helpers ---------------------------------------------------------------
create or replace function my_party() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce((select party from users where id = auth.uid()), 'IDOT');
$$;

create or replace function my_org() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce((select org_id from users where id = auth.uid()), 'IDOT');
$$;

-- IDOT users keep their 0003 scope. External parties may see a contract ONLY if
-- their org is explicitly party to it. This is the hard wall.
create or replace function party_can_see_contract(cid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when my_party() = 'IDOT' then true
    else exists (
      select 1 from contract_parties cp
      where cp.contract_id = cid and cp.org_id = my_org()
    )
  end;
$$;

-- Compose with the 0003 scope check: a row is visible only if BOTH the IDOT
-- district/assignment scope (can_see_contract) AND the party wall pass.
create or replace function visible_contract(cid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select can_see_contract(cid) and party_can_see_contract(cid);
$$;

-- --- party-aware contract read --------------------------------------------
-- Replaces the 0003 contracts read policy so external parties are walled off.
drop policy if exists contracts_read on contracts;
create policy contracts_read on contracts for select using (visible_contract(id));

create policy contract_parties_read on contract_parties for select
  using (visible_contract(contract_id));
create policy contract_parties_admin on contract_parties for all
  using (is_admin()) with check (is_admin());

-- --- RLS for the tables this build adds ------------------------------------
-- File references (S1): scoped by the entity's contract where derivable; for the
-- groundwork we gate by authenticated + (admin or IDOT) and rely on Storage
-- policies for the bytes. A later pass keys scope_key → contract for tight scope.
create table if not exists file_refs (
  scope_key text primary key,
  refs      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table file_refs enable row level security;
create policy file_refs_read on file_refs for select using (auth.role() = 'authenticated');
create policy file_refs_write on file_refs for all
  using (not has_role('Contractor')) with check (not has_role('Contractor'));

create table if not exists material_allowances (
  id           text primary key,
  contract_id  text not null references contracts(id) on delete cascade,
  data         jsonb
);
alter table material_allowances enable row level security;
create policy matallow_read on material_allowances for select using (visible_contract(contract_id));
create policy matallow_write on material_allowances for all
  using (visible_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()))
  with check (visible_contract(contract_id) and (has_role('ResidentEngineer') or is_admin()));

create table if not exists qmp_packages (
  id           text primary key,
  contract_id  text references contracts(id) on delete cascade,
  data         jsonb
);
alter table qmp_packages enable row level security;
create policy qmp_read on qmp_packages for select using (contract_id is null or visible_contract(contract_id));
create policy qmp_write on qmp_packages for all
  using ((contract_id is null or visible_contract(contract_id)) and not has_role('Contractor'))
  with check ((contract_id is null or visible_contract(contract_id)) and not has_role('Contractor'));

-- --- verification (run as the test users) ----------------------------------
--   set request.jwt.claims to a Contractor of org 'Prairie State Construction':
--     select count(*) from contracts;                  -- only their party's rows
--     select * from contracts where id = '<idot-only>'; -- 0 rows (walled, not filtered)
--   set claims to an IDOT inspector:
--     select count(*) from contracts;                  -- their district/assignment scope, unchanged
