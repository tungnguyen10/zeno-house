-- Enforce 1 active occupancy per tenant at any time.
-- A tenant can only appear once in contract_occupants with move_out_date IS NULL
-- (i.e., currently residing). Once moved out, the record is kept for history.
CREATE UNIQUE INDEX IF NOT EXISTS contract_occupants_active_tenant_unique
  ON public.contract_occupants (tenant_id)
  WHERE move_out_date IS NULL;
