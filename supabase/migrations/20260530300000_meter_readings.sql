CREATE TABLE public.meter_readings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_device_id uuid NOT NULL REFERENCES public.meter_devices(id) ON DELETE RESTRICT,
  room_id         uuid NOT NULL REFERENCES public.rooms(id),
  building_id     uuid NOT NULL REFERENCES public.buildings(id),
  meter_type      text NOT NULL CHECK (meter_type IN ('electricity', 'water')),
  reading_type    text NOT NULL CHECK (reading_type IN ('monthly', 'handover_in', 'handover_out')),
  period_year     integer NOT NULL,
  period_month    integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reading_date    date NOT NULL,
  reading_value   numeric(12,3) NOT NULL CHECK (reading_value >= 0),
  is_estimated    boolean NOT NULL DEFAULT false,
  notes           text,
  recorded_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (meter_device_id, period_year, period_month, reading_type)
);

CREATE INDEX idx_meter_readings_building_period ON public.meter_readings (building_id, period_year, period_month);
CREATE INDEX idx_meter_readings_room ON public.meter_readings (room_id, period_year, period_month);

-- Row Level Security (server uses service role which bypasses RLS)
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "meter_readings_admin_all"
  ON public.meter_readings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read + write
CREATE POLICY "meter_readings_manager_all"
  ON public.meter_readings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
