-- Trip Lah! V1.0 Foundation schema
-- Additive only: does not alter or delete Travel Lah! legacy tables or payloads.
-- Target: existing forest-studio-desk-lah Supabase project.
-- Apply only after reviewing this file; frontend Stage A initially uses owner-only access.

create table if not exists public.trip_lah_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  destination text not null default '',
  start_date date,
  end_date date,
  base_currency_code text not null default 'MYR' check (base_currency_code ~ '^[A-Z]{3}$'),
  budget_minor bigint not null default 0 check (budget_minor >= 0),
  status text not null default 'planning' check (status in ('planning','active','completed','archived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_trip_dates_check check (start_date is null or end_date is null or end_date >= start_date),
  constraint trip_lah_trips_id_owner_unique unique (id, owner_id)
);

create table if not exists public.trip_lah_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  member_type text not null default 'traveler' check (member_type in ('owner','traveler')),
  sort_order integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_members_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_members_id_trip_owner_unique unique (id, trip_id, owner_id)
);

create unique index if not exists trip_lah_one_owner_member_per_trip
  on public.trip_lah_members(trip_id) where member_type = 'owner';

create table if not exists public.trip_lah_currencies (
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  currency_name text not null default '',
  minor_unit_digits smallint not null default 2 check (minor_unit_digits between 0 and 4),
  is_base boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency_code),
  constraint trip_lah_currencies_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade
);

create unique index if not exists trip_lah_one_base_currency_per_trip
  on public.trip_lah_currencies(trip_id) where is_base;

create table if not exists public.trip_lah_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_currency_code text not null,
  to_currency_code text not null,
  rate numeric(24,12) not null check (rate > 0),
  effective_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','bank','card','api')),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint trip_lah_rates_different_currency check (from_currency_code <> to_currency_code),
  constraint trip_lah_rates_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_rates_from_currency_fk foreign key (trip_id, from_currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_rates_to_currency_fk foreign key (trip_id, to_currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_rates_unique_time unique (trip_id, from_currency_code, to_currency_code, effective_at)
);

create table if not exists public.trip_lah_funds (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  fund_type text not null default 'shared' check (fund_type in ('shared','personal')),
  currency_code text not null,
  linked_member_id uuid,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_funds_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_funds_currency_fk foreign key (trip_id, currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_funds_member_fk foreign key (linked_member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_personal_fund_member_check check (
    (fund_type = 'shared' and linked_member_id is null) or
    (fund_type = 'personal' and linked_member_id is not null)
  ),
  constraint trip_lah_funds_id_trip_owner_unique unique (id, trip_id, owner_id)
);

create table if not exists public.trip_lah_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  category text not null default 'other',
  currency_code text not null,
  amount_minor bigint not null check (amount_minor > 0),
  base_currency_code text not null,
  base_amount_minor bigint not null check (base_amount_minor > 0),
  exchange_rate_snapshot numeric(24,12) not null default 1 check (exchange_rate_snapshot > 0),
  payer_type text not null check (payer_type in ('personal','fund')),
  paid_by_member_id uuid,
  fund_id uuid,
  split_mode text not null check (split_mode in ('fund','equal','individual','percentage','custom')),
  note text not null default '',
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_expenses_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_expenses_currency_fk foreign key (trip_id, currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_expenses_base_currency_fk foreign key (trip_id, base_currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_expenses_payer_member_fk foreign key (paid_by_member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_expenses_fund_fk foreign key (fund_id, trip_id, owner_id)
    references public.trip_lah_funds(id, trip_id, owner_id),
  constraint trip_lah_expenses_payment_source_check check (
    (payer_type = 'fund' and fund_id is not null and paid_by_member_id is null and split_mode = 'fund') or
    (payer_type = 'personal' and fund_id is null and paid_by_member_id is not null and split_mode in ('equal','individual','percentage','custom'))
  ),
  constraint trip_lah_expenses_id_trip_owner_unique unique (id, trip_id, owner_id)
);

create table if not exists public.trip_lah_expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null,
  share_minor bigint not null check (share_minor >= 0),
  share_percent numeric(9,6) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  created_at timestamptz not null default now(),
  constraint trip_lah_splits_expense_fk foreign key (expense_id, trip_id, owner_id)
    references public.trip_lah_expenses(id, trip_id, owner_id) on delete cascade,
  constraint trip_lah_splits_member_fk foreign key (member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_splits_one_member_per_expense unique (expense_id, member_id)
);

create table if not exists public.trip_lah_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null,
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('contribution','expense','refund','adjustment')),
  direction text not null check (direction in ('in','out')),
  amount_minor bigint not null check (amount_minor > 0),
  member_id uuid,
  expense_id uuid,
  transaction_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint trip_lah_fund_tx_fund_fk foreign key (fund_id, trip_id, owner_id)
    references public.trip_lah_funds(id, trip_id, owner_id) on delete cascade,
  constraint trip_lah_fund_tx_member_fk foreign key (member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_fund_tx_contribution_direction check (
    (transaction_type = 'contribution' and direction = 'in') or
    (transaction_type = 'expense' and direction = 'out') or
    (transaction_type = 'refund' and direction in ('in','out')) or
    transaction_type = 'adjustment'
  ),
  constraint trip_lah_fund_tx_expense_fk foreign key (expense_id, trip_id, owner_id)
    references public.trip_lah_expenses(id, trip_id, owner_id) on delete restrict
);

create unique index if not exists trip_lah_one_fund_tx_per_expense
  on public.trip_lah_fund_transactions(expense_id)
  where transaction_type = 'expense' and expense_id is not null;

create table if not exists public.trip_lah_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_type text not null default 'other' check (booking_type in ('flight','hotel','ticket','transport','activity','other')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  provider text not null default '',
  confirmation_code text not null default '',
  booking_date date,
  start_at timestamptz,
  end_at timestamptz,
  location text not null default '',
  details text not null default '',
  linked_expense_id uuid unique,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_bookings_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_bookings_id_trip_owner_unique unique (id, trip_id, owner_id),
  constraint trip_lah_bookings_expense_fk foreign key (linked_expense_id, trip_id, owner_id)
    references public.trip_lah_expenses(id, trip_id, owner_id) on delete set null (linked_expense_id)
);

create table if not exists public.trip_lah_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_date date not null,
  start_time time,
  end_time time,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  item_type text not null default 'other' check (item_type in ('transport','food','sightseeing','shopping','hotel','event','other')),
  location text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  linked_booking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_itinerary_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_itinerary_time_check check (start_time is null or end_time is null or end_time >= start_time),
  constraint trip_lah_itinerary_booking_fk foreign key (linked_booking_id, trip_id, owner_id)
    references public.trip_lah_bookings(id, trip_id, owner_id) on delete set null (linked_booking_id)
);

create table if not exists public.trip_lah_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  currency_code text not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','settled','cancelled')),
  settled_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_lah_settlements_trip_owner_fk foreign key (trip_id, owner_id)
    references public.trip_lah_trips(id, owner_id) on delete cascade,
  constraint trip_lah_settlements_from_member_fk foreign key (from_member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_settlements_to_member_fk foreign key (to_member_id, trip_id, owner_id)
    references public.trip_lah_members(id, trip_id, owner_id),
  constraint trip_lah_settlements_currency_fk foreign key (trip_id, currency_code)
    references public.trip_lah_currencies(trip_id, currency_code),
  constraint trip_lah_settlements_different_members check (from_member_id <> to_member_id),
  constraint trip_lah_settlements_settled_at_check check (
    (status = 'settled' and settled_at is not null) or
    (status <> 'settled' and settled_at is null)
  )
);

create index if not exists trip_lah_members_owner_idx on public.trip_lah_members(owner_id, trip_id);
create index if not exists trip_lah_currencies_owner_idx on public.trip_lah_currencies(owner_id, trip_id);
create index if not exists trip_lah_funds_owner_idx on public.trip_lah_funds(owner_id, trip_id);
create index if not exists trip_lah_expenses_owner_idx on public.trip_lah_expenses(owner_id, trip_id);
create index if not exists trip_lah_trips_owner_dates_idx on public.trip_lah_trips(owner_id, start_date desc);
create index if not exists trip_lah_members_trip_idx on public.trip_lah_members(trip_id, sort_order);
create index if not exists trip_lah_rates_lookup_idx on public.trip_lah_exchange_rates(trip_id, from_currency_code, to_currency_code, effective_at desc);
create index if not exists trip_lah_funds_trip_idx on public.trip_lah_funds(trip_id, fund_type);
create index if not exists trip_lah_expenses_trip_date_idx on public.trip_lah_expenses(trip_id, expense_date desc);
create index if not exists trip_lah_splits_expense_idx on public.trip_lah_expense_splits(expense_id);
create index if not exists trip_lah_fund_tx_fund_date_idx on public.trip_lah_fund_transactions(fund_id, transaction_date desc);
create index if not exists trip_lah_bookings_trip_date_idx on public.trip_lah_bookings(trip_id, booking_date);
create index if not exists trip_lah_itinerary_trip_date_idx on public.trip_lah_itinerary_items(trip_id, item_date, sort_order);
create index if not exists trip_lah_settlements_trip_status_idx on public.trip_lah_settlements(trip_id, status);

-- Every exposed table is owner-scoped. Travellers are data records only in V1.0;
-- they do not receive login credentials or direct database access.
do $$
declare
  t text;
begin
  foreach t in array array[
    'trip_lah_trips',
    'trip_lah_members',
    'trip_lah_currencies',
    'trip_lah_exchange_rates',
    'trip_lah_funds',
    'trip_lah_expenses',
    'trip_lah_expense_splits',
    'trip_lah_fund_transactions',
    'trip_lah_bookings',
    'trip_lah_itinerary_items',
    'trip_lah_settlements'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- Financial fund movements are append-only. Corrections are represented by
-- refund/adjustment rows instead of silently editing historical transactions.
revoke update, delete on table public.trip_lah_fund_transactions from authenticated;

create or replace function private.trip_lah_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'trip_lah_trips',
    'trip_lah_members',
    'trip_lah_currencies',
    'trip_lah_funds',
    'trip_lah_expenses',
    'trip_lah_bookings',
    'trip_lah_itinerary_items',
    'trip_lah_settlements'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.trip_lah_touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end $$;

-- Immutable audit trail for important trip and financial records.
-- No client-side INSERT/UPDATE/DELETE permission; rows are written by this trigger only.
create table if not exists public.trip_lah_audit_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid,
  entity_table text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.trip_lah_audit_logs enable row level security;
revoke all on table public.trip_lah_audit_logs from anon, authenticated;
grant select on table public.trip_lah_audit_logs to authenticated;
drop policy if exists trip_lah_audit_logs_owner_select on public.trip_lah_audit_logs;
create policy trip_lah_audit_logs_owner_select on public.trip_lah_audit_logs
  for select to authenticated using (owner_id = (select auth.uid()));
create index if not exists trip_lah_audit_logs_trip_created_idx
  on public.trip_lah_audit_logs(trip_id, created_at desc);
create index if not exists trip_lah_audit_logs_owner_created_idx
  on public.trip_lah_audit_logs(owner_id, created_at desc);

create or replace function private.trip_lah_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trip_audit$
declare
  v_row jsonb;
  v_before jsonb;
  v_after jsonb;
  v_trip_id uuid;
  v_owner_id uuid;
  v_entity_id uuid;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_row := pg_catalog.to_jsonb(old);
    v_before := v_row;
    v_after := null;
    v_action := 'delete';
  elsif tg_op = 'UPDATE' then
    v_row := pg_catalog.to_jsonb(new);
    v_before := pg_catalog.to_jsonb(old);
    v_after := v_row;
    v_action := 'update';
  else
    v_row := pg_catalog.to_jsonb(new);
    v_before := null;
    v_after := v_row;
    v_action := 'insert';
  end if;

  v_owner_id := (v_row ->> 'owner_id')::uuid;
  v_entity_id := (v_row ->> 'id')::uuid;
  v_trip_id := coalesce((v_row ->> 'trip_id')::uuid, v_entity_id);

  insert into public.trip_lah_audit_logs
    (trip_id, owner_id, actor_id, entity_table, entity_id, action, before_data, after_data)
  values
    (v_trip_id, v_owner_id, auth.uid(), tg_table_name, v_entity_id, v_action, v_before, v_after);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$trip_audit$;

do $trip_audit$
declare
  t text;
begin
  foreach t in array array[
    'trip_lah_trips',
    'trip_lah_members',
    'trip_lah_funds',
    'trip_lah_expenses',
    'trip_lah_expense_splits',
    'trip_lah_fund_transactions',
    'trip_lah_bookings',
    'trip_lah_itinerary_items',
    'trip_lah_settlements'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit_log', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.trip_lah_write_audit_log()',
      t || '_audit_log', t
    );
  end loop;
end $trip_audit$;

notify pgrst, 'reload schema';
