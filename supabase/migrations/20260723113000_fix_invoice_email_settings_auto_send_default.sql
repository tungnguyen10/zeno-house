-- Ensure legacy environments keep auto_send_enabled aligned with the
-- invoice email delivery contract.

begin;

alter table if exists public.building_invoice_email_settings
  alter column auto_send_enabled set default false;

update public.building_invoice_email_settings
   set auto_send_enabled = false
 where auto_send_enabled is null;

alter table if exists public.building_invoice_email_settings
  alter column auto_send_enabled set not null;

commit;