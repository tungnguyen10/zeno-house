INSERT INTO public.service_catalog (code, name, pricing_type, unit, sort_order) VALUES
  ('internet',          'Mạng Internet',   'fixed_per_room', NULL,     1),
  ('garbage',           'Phí rác',         'per_person',     'người',  2),
  ('parking_motorbike', 'Gửi xe máy',      'per_vehicle',    'xe',     3),
  ('parking_bicycle',   'Gửi xe đạp',      'per_vehicle',    'xe',     4),
  ('cleaning',          'Vệ sinh',         'fixed_per_room', NULL,     5),
  ('elevator',          'Thang máy',       'per_person',     'người',  6),
  ('surcharge',         'Phụ thu',         'fixed_per_room', NULL,     7),
  ('other',             'Khác',            'fixed_per_room', NULL,     8);
