-- =============================================================================
-- Contract create drafts (V2 PR4a)
-- =============================================================================
-- One server-side create-contract draft per user. Service-role only.
-- Data impact: ADDITIVE ONLY (new table).
-- =============================================================================

create table if not exists public.contract_create_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (octet_length(payload::text) <= 65536),
  updated_at timestamptz not null default now()
);

drop trigger if exists contract_create_drafts_set_updated_at on public.contract_create_drafts;
create trigger contract_create_drafts_set_updated_at
  before update on public.contract_create_drafts
  for each row execute function public.set_updated_at();

alter table public.contract_create_drafts enable row level security;
revoke all on table public.contract_create_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.contract_create_drafts to service_role;
