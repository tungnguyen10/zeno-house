-- Add renewal tracking columns to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS previous_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_end_date date NULL,
  ADD COLUMN IF NOT EXISTS renewal_count int NOT NULL DEFAULT 0;

-- Add 'renewed' to valid status values by dropping and recreating the check constraint
-- First check if constraint exists (it was added in an earlier migration)
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('active', 'expired', 'terminated', 'renewed'));
