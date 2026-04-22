-- ============================================================
-- 001_initial_schema.sql
-- Initial schema for zeno-house rental management system
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'tenant');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance', 'reserved');
CREATE TYPE contract_status AS ENUM ('pending', 'active', 'expired', 'terminated');
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE maintenance_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'e_wallet');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: extends auth.users with app-specific data
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  role        user_role NOT NULL DEFAULT 'tenant',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- buildings: rental properties managed by a manager
CREATE TABLE buildings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- rooms: individual rentable units within a building
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  room_number     TEXT NOT NULL,
  floor           INTEGER,
  area            NUMERIC(8,2),
  base_price      NUMERIC(12,2) NOT NULL,
  deposit_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_occupants   INTEGER NOT NULL DEFAULT 1,
  status          room_status NOT NULL DEFAULT 'available',
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, room_number)
);

-- service_fee_types: electricity, water, internet, etc.
CREATE TABLE service_fee_types (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT,
  unit_price  NUMERIC(12,2) NOT NULL,
  is_utility  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- room_service_fees: which fees apply to which rooms (with optional override price)
CREATE TABLE room_service_fees (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  service_fee_type_id UUID NOT NULL REFERENCES service_fee_types(id) ON DELETE CASCADE,
  custom_price        NUMERIC(12,2),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (room_id, service_fee_type_id)
);

-- tenants: extended profile info for users with tenant role
CREATE TABLE tenants (
  id                      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  identity_number         TEXT,
  identity_issued_date    DATE,
  identity_issued_place   TEXT,
  permanent_address       TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contract_templates: reusable contract text templates per building
CREATE TABLE contract_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contracts: rental agreements between a tenant and a room
CREATE TABLE contracts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES rooms(id),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  template_id   UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  monthly_rent  NUMERIC(12,2) NOT NULL,
  deposit_paid  NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day   INTEGER NOT NULL DEFAULT 1 CHECK (payment_day BETWEEN 1 AND 28),
  status        contract_status NOT NULL DEFAULT 'pending',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- room_tenants: current occupants of a room (supports multiple tenants per room)
CREATE TABLE room_tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id   UUID REFERENCES contracts(id) ON DELETE SET NULL,
  move_in_date  DATE NOT NULL,
  move_out_date DATE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoices: monthly billing records
CREATE TABLE invoices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id   UUID NOT NULL REFERENCES contracts(id),
  room_id       UUID NOT NULL REFERENCES rooms(id),
  billing_month DATE NOT NULL,
  due_date      DATE NOT NULL,
  base_rent     NUMERIC(12,2) NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL,
  paid_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        invoice_status NOT NULL DEFAULT 'pending',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoice_service_fees: line items for each service fee on an invoice
CREATE TABLE invoice_service_fees (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_fee_type_id UUID NOT NULL REFERENCES service_fee_types(id),
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price          NUMERIC(12,2) NOT NULL,
  amount              NUMERIC(12,2) NOT NULL
);

-- invoice_discounts: manual discounts applied to an invoice
CREATE TABLE invoice_discounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL
);

-- utility_readings: meter readings for electricity/water
CREATE TABLE utility_readings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id             UUID NOT NULL REFERENCES rooms(id),
  service_fee_type_id UUID NOT NULL REFERENCES service_fee_types(id),
  reading_date        DATE NOT NULL,
  previous_reading    NUMERIC(10,3) NOT NULL,
  current_reading     NUMERIC(10,3) NOT NULL,
  consumption         NUMERIC(10,3) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- meter_changes: log of meter replacements or resets
CREATE TABLE meter_changes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id             UUID NOT NULL REFERENCES rooms(id),
  service_fee_type_id UUID NOT NULL REFERENCES service_fee_types(id),
  change_date         DATE NOT NULL,
  old_meter_reading   NUMERIC(10,3),
  new_meter_reading   NUMERIC(10,3) NOT NULL DEFAULT 0,
  reason              TEXT,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payments: records of money received against invoices
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id),
  amount           NUMERIC(12,2) NOT NULL,
  payment_date     DATE NOT NULL,
  payment_method   payment_method NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- promotions: discount campaigns per building
CREATE TABLE promotions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  discount_type  discount_type NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- applied_promotions: which promotions have been applied to contracts
CREATE TABLE applied_promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES promotions(id),
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- expense_categories: categories for tracking building expenses
CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- expenses: operational expenses per building
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id  UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL,
  description  TEXT NOT NULL,
  expense_date DATE NOT NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- maintenance_requests: repair/maintenance tickets raised by tenants or managers
CREATE TABLE maintenance_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES rooms(id),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      maintenance_status NOT NULL DEFAULT 'open',
  priority    INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications: in-app notifications per user
CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  type           TEXT NOT NULL,
  reference_id   UUID,
  reference_type TEXT,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notification_settings: per-user notification preferences
CREATE TABLE notification_settings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_due        BOOLEAN NOT NULL DEFAULT true,
  contract_expiry    BOOLEAN NOT NULL DEFAULT true,
  maintenance_update BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id)
);

-- room_transfers: history of tenants moving between rooms
CREATE TABLE room_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  from_room_id    UUID NOT NULL REFERENCES rooms(id),
  to_room_id      UUID NOT NULL REFERENCES rooms(id),
  transfer_date   DATE NOT NULL,
  old_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  new_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_buildings_manager_id ON buildings(manager_id);
CREATE INDEX idx_rooms_building_id ON rooms(building_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_contracts_room_id ON contracts(room_id);
CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_room_tenants_room_id ON room_tenants(room_id);
CREATE INDEX idx_room_tenants_tenant_id ON room_tenants(tenant_id);
CREATE INDEX idx_invoices_contract_id ON invoices(contract_id);
CREATE INDEX idx_invoices_room_id ON invoices(room_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_billing_month ON invoices(billing_month);
CREATE INDEX idx_utility_readings_room_id ON utility_readings(room_id);
CREATE INDEX idx_maintenance_requests_room_id ON maintenance_requests(room_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_expenses_building_id ON expenses(building_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

-- ============================================================
-- TRIGGER: auto-create profile on new auth user
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'tenant');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Prevent non-admins from changing their own role (privilege escalation guard)
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
      RAISE EXCEPTION 'Permission denied: role can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER enforce_role_immutable
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();

-- ============================================================
-- HELPER FUNCTIONS (used in RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, auth;

-- Returns true if the current user manages the given building
CREATE OR REPLACE FUNCTION manages_building(p_building_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings
    WHERE id = p_building_id AND manager_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, auth;

-- Returns building_id for a given room
CREATE OR REPLACE FUNCTION room_building_id(p_room_id UUID)
RETURNS UUID AS $$
  SELECT building_id FROM public.rooms WHERE id = p_room_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, auth;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_service_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_service_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_transfers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON profiles
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "users: read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users: update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------
-- buildings
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON buildings
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: read/write own buildings" ON buildings
  FOR ALL USING (manager_id = auth.uid());

-- ------------------------------------------------------------
-- rooms
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON rooms
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: access rooms in own buildings" ON rooms
  FOR ALL USING (manages_building(building_id));

CREATE POLICY "tenant: read own room" ON rooms
  FOR SELECT USING (
    id IN (
      SELECT rt.room_id FROM room_tenants rt WHERE rt.tenant_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- service_fee_types
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON service_fee_types
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: access own building fees" ON service_fee_types
  FOR ALL USING (manages_building(building_id));

-- ------------------------------------------------------------
-- room_service_fees
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON room_service_fees
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: access fees for own rooms" ON room_service_fees
  FOR ALL USING (manages_building(room_building_id(room_id)));

-- ------------------------------------------------------------
-- tenants
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON tenants
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: read tenants in own buildings" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT rt.tenant_id FROM room_tenants rt
      WHERE manages_building(room_building_id(rt.room_id))
    )
  );

CREATE POLICY "tenant: read own record" ON tenants
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "tenant: insert own record" ON tenants
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "tenant: update own record" ON tenants
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------
-- contract_templates
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON contract_templates
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building templates" ON contract_templates
  FOR ALL USING (manages_building(building_id));

-- ------------------------------------------------------------
-- contracts
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON contracts
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage contracts in own buildings" ON contracts
  FOR ALL USING (manages_building(room_building_id(room_id)));

CREATE POLICY "tenant: read own contracts" ON contracts
  FOR SELECT USING (tenant_id = auth.uid());

-- ------------------------------------------------------------
-- room_tenants
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON room_tenants
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage room_tenants in own buildings" ON room_tenants
  FOR ALL USING (manages_building(room_building_id(room_id)));

CREATE POLICY "tenant: read own room_tenants" ON room_tenants
  FOR SELECT USING (tenant_id = auth.uid());

-- ------------------------------------------------------------
-- invoices
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON invoices
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage invoices in own buildings" ON invoices
  FOR ALL USING (manages_building(room_building_id(room_id)));

CREATE POLICY "tenant: read own invoices" ON invoices
  FOR SELECT USING (
    contract_id IN (SELECT id FROM contracts WHERE tenant_id = auth.uid())
  );

-- ------------------------------------------------------------
-- invoice_service_fees
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON invoice_service_fees
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building invoice fees" ON invoice_service_fees
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE manages_building(room_building_id(room_id))
    )
  );

CREATE POLICY "tenant: read own invoice fees" ON invoice_service_fees
  FOR SELECT USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE c.tenant_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- invoice_discounts
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON invoice_discounts
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building invoice discounts" ON invoice_discounts
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE manages_building(room_building_id(room_id))
    )
  );

CREATE POLICY "tenant: read own invoice discounts" ON invoice_discounts
  FOR SELECT USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE c.tenant_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- utility_readings
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON utility_readings
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage readings in own buildings" ON utility_readings
  FOR ALL USING (manages_building(room_building_id(room_id)));

-- ------------------------------------------------------------
-- meter_changes
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON meter_changes
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage meter changes in own buildings" ON meter_changes
  FOR ALL USING (manages_building(room_building_id(room_id)));

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON payments
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage payments in own buildings" ON payments
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE manages_building(room_building_id(room_id))
    )
  );

CREATE POLICY "tenant: read own payments" ON payments
  FOR SELECT USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE c.tenant_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- promotions
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON promotions
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building promotions" ON promotions
  FOR ALL USING (manages_building(building_id));

-- ------------------------------------------------------------
-- applied_promotions
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON applied_promotions
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage applied promotions in own buildings" ON applied_promotions
  FOR ALL USING (
    contract_id IN (
      SELECT id FROM contracts WHERE manages_building(room_building_id(room_id))
    )
  );

-- ------------------------------------------------------------
-- expense_categories
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON expense_categories
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building categories" ON expense_categories
  FOR ALL USING (manages_building(building_id));

-- ------------------------------------------------------------
-- expenses
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON expenses
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage own building expenses" ON expenses
  FOR ALL USING (manages_building(building_id));

-- ------------------------------------------------------------
-- maintenance_requests
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON maintenance_requests
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage requests in own buildings" ON maintenance_requests
  FOR ALL USING (manages_building(room_building_id(room_id)));

CREATE POLICY "tenant: read own requests" ON maintenance_requests
  FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "tenant: create requests" ON maintenance_requests
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid()
    AND room_id IN (
      SELECT rt.room_id FROM room_tenants rt WHERE rt.tenant_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON notifications
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "users: read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users: mark own notifications read" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- notification_settings
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON notification_settings
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "users: manage own settings" ON notification_settings
  FOR ALL USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- room_transfers
-- ------------------------------------------------------------
CREATE POLICY "admin: full access" ON room_transfers
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage transfers in own buildings" ON room_transfers
  FOR ALL USING (
    manages_building(room_building_id(from_room_id))
    OR manages_building(room_building_id(to_room_id))
  );

-- ============================================================
-- STORAGE BUCKETS
-- (Run these via Supabase dashboard or management API;
--  SQL storage policies shown below for reference)
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('avatars', 'avatars', true),
--   ('documents', 'documents', false),
--   ('meters', 'meters', false),
--   ('contracts', 'contracts', false);

-- Storage RLS: avatars (public read)
-- CREATE POLICY "public read avatars" ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
-- CREATE POLICY "authenticated upload avatars" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Storage RLS: private buckets (owner-scoped)
-- CREATE POLICY "owner access documents" ON storage.objects FOR ALL
--   USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "owner access meters" ON storage.objects FOR ALL
--   USING (bucket_id = 'meters' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "owner access contracts" ON storage.objects FOR ALL
--   USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
