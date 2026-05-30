ALTER TABLE public.tenants
  ADD COLUMN gender                   text CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN occupation               text,
  ADD COLUMN id_issued_date           date,
  ADD COLUMN id_issued_place          text,
  ADD COLUMN emergency_contact_name   text,
  ADD COLUMN emergency_contact_phone  text;
