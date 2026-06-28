-- Cross-period invoice browse support.
--
-- The browse query filters building/year/month through billing_periods and then
-- filters/sorts invoices by status, due date, balance, issued_at, and id.
-- `invoices` intentionally does not duplicate building_id/period fields.

CREATE INDEX IF NOT EXISTS idx_billing_periods_invoice_browse
  ON public.billing_periods (building_id, period_year, period_month, id);

CREATE INDEX IF NOT EXISTS idx_invoices_browse_status_due_issued
  ON public.invoices (status, due_date, balance_amount, issued_at DESC, id DESC);
