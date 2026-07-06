UPDATE public.service_catalog
SET
  name = CASE code
    WHEN 'internet' THEN 'Mạng Internet'
    WHEN 'garbage' THEN 'Phí rác'
    WHEN 'parking_motorbike' THEN 'Gửi xe máy'
    WHEN 'parking_bicycle' THEN 'Gửi xe đạp'
    WHEN 'cleaning' THEN 'Vệ sinh'
    WHEN 'elevator' THEN 'Thang máy'
    WHEN 'surcharge' THEN 'Phụ thu'
    WHEN 'other' THEN 'Khác'
    ELSE name
  END,
  unit = CASE code
    WHEN 'garbage' THEN 'người'
    WHEN 'elevator' THEN 'người'
    WHEN 'parking_motorbike' THEN 'xe'
    WHEN 'parking_bicycle' THEN 'xe'
    ELSE unit
  END
WHERE code IN (
  'internet',
  'garbage',
  'parking_motorbike',
  'parking_bicycle',
  'cleaning',
  'elevator',
  'surcharge',
  'other'
);
