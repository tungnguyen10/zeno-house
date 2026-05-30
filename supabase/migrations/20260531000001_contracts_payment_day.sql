-- Task 1.2: Add payment_day column to contracts

ALTER TABLE public.contracts
  ADD COLUMN payment_day smallint CHECK (payment_day BETWEEN 1 AND 31);
