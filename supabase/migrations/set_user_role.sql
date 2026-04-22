-- ============================================================
-- set_user_role.sql
-- Utility: manually set a user's role
-- Run in Supabase SQL Editor (requires service role to bypass RLS)
-- ============================================================

-- Roles available: 'admin' | 'manager' | 'tenant'
--
--   admin   — full access to everything
--   manager — manage own buildings, rooms, tenants, contracts, invoices
--   tenant  — read-only: own room, contract, invoice
--
-- NOTE: trigger prevent_role_escalation blocks role changes from normal clients.
-- Must run here in SQL Editor (service role) to take effect.

-- By email
UPDATE profiles
SET role = 'admin'   -- change to: 'manager' | 'tenant'
WHERE email = 'your@email.com';

-- By user id
-- UPDATE profiles
-- SET role = 'admin'
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- Verify
SELECT id, email, role FROM profiles WHERE email = 'your@email.com';
