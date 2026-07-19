-- Fence pending-account approval work and tag every grant with the claim that
-- created it. This prevents retries from finalizing a newer claim or deleting
-- an unrelated assignment/link during compensation.

begin;

alter table public.access_requests
  add column approval_claim_token uuid;

alter table public.user_building_assignments
  add column approval_claim_token uuid;

alter table public.tenant_user_links
  add column approval_claim_token uuid;

create index idx_user_building_assignments_approval_claim
  on public.user_building_assignments(approval_claim_token)
  where approval_claim_token is not null;

create unique index idx_tenant_user_links_approval_claim
  on public.tenant_user_links(approval_claim_token)
  where approval_claim_token is not null;

commit;
