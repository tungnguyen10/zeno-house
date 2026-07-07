-- Fix the source constraint on reserve_fund_transactions to allow all three values
begin;

-- Drop the existing source check constraint if it exists (it might have wrong values)
alter table public.reserve_fund_transactions
  drop constraint if exists reserve_fund_transactions_source_check;

-- Re-add the source constraint with the correct values
alter table public.reserve_fund_transactions
  add constraint reserve_fund_transactions_source_check
    check (source in ('manual', 'monthly_accrual', 'expense_deduction'));

commit;
