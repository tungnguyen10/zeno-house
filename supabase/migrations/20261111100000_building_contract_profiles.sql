-- =============================================================================
-- Building contract profiles (V2 PR1)
-- =============================================================================
-- Lessor (contract signer) identity and default contract policy per building.
-- Contains personal data: service_role only, no RLS policies for clients.
--
-- Data impact: ADDITIVE ONLY (new table).
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
-- regenerate database types:
--   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--     --schema public > app/types/database.types.ts
-- =============================================================================

create table if not exists public.building_contract_profiles (
  building_id uuid primary key references public.buildings(id) on delete cascade,

  lessor_full_name text check (lessor_full_name is null or length(trim(lessor_full_name)) between 2 and 100),
  lessor_date_of_birth date,
  lessor_permanent_address text check (lessor_permanent_address is null or length(lessor_permanent_address) <= 255),
  lessor_id_number text check (lessor_id_number is null or lessor_id_number ~ '^[0-9]{9}([0-9]{3})?$'),
  lessor_id_issued_date date check (lessor_id_issued_date is null or lessor_id_issued_date <= current_date),
  lessor_id_issued_place text check (lessor_id_issued_place is null or length(lessor_id_issued_place) <= 150),
  lessor_phone text check (lessor_phone is null or length(lessor_phone) between 8 and 20),

  brand_name text check (brand_name is null or length(trim(brand_name)) between 1 and 100),

  default_term_months integer check (default_term_months is null or default_term_months between 1 and 60),
  default_deposit_months numeric(3,1) check (default_deposit_months is null or default_deposit_months between 0 and 6),

  notice_days integer check (notice_days is null or notice_days between 0 and 180),
  deposit_refund_days integer check (deposit_refund_days is null or deposit_refund_days between 0 and 90),
  renewal_months integer check (renewal_months is null or renewal_months between 0 and 24),
  extra_occupant_fee numeric(12,0) check (extra_occupant_fee is null or extra_occupant_fee >= 0),
  drilling_fee numeric(12,0) check (drilling_fee is null or drilling_fee >= 0),
  fingerprint_reset_fee numeric(12,0) check (fingerprint_reset_fee is null or fingerprint_reset_fee >= 0),

  signed_copies integer not null default 2 check (signed_copies between 1 and 10),
  copies_per_party integer not null default 1 check (copies_per_party between 1 and 5),
  constraint building_contract_profiles_copies_check check (copies_per_party * 2 <= signed_copies),

  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists building_contract_profiles_set_updated_at on public.building_contract_profiles;
create trigger building_contract_profiles_set_updated_at
  before update on public.building_contract_profiles
  for each row execute function public.set_updated_at();

alter table public.building_contract_profiles enable row level security;
revoke all on table public.building_contract_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.building_contract_profiles to service_role;
