-- Insert sample guard location data for testing
INSERT INTO guard_locations (
  shift_id, 
  guard_id, 
  company_id, 
  location_lat, 
  location_lng, 
  location_address, 
  battery_level, 
  accuracy
) VALUES 
-- SaidRahim Sadat's location (active shift)
(
  'a4112147-91cb-4d69-b883-e733aa031ccd',
  (SELECT id FROM profiles WHERE first_name = 'SaidRahim' AND last_name = 'Sadat'),
  'f53afed0-e917-4861-a0c2-0865a5147811',
  34.0522, 
  -118.2437, 
  'Downtown Los Angeles, CA',
  85,
  10
),
-- Zabihullah Zadran's location (active shift)
(
  'bcbe9508-a678-4db1-a335-da1d321667a8',
  (SELECT id FROM profiles WHERE first_name = 'Zabihullah' AND last_name = 'Zadran'),
  'f53afed0-e917-4861-a0c2-0865a5147811',
  34.0689, 
  -118.4452, 
  'Santa Monica, CA',
  72,
  15
),
-- Najib khan's location (active shift)
(
  '070783a0-0fb3-4cf2-bf3d-3e6ad3025411',
  (SELECT id FROM profiles WHERE first_name = 'Najib' AND last_name = 'khan'),
  'e327038f-4f88-4ea3-9e84-257e302f0fcf',
  34.1030, 
  -118.2693, 
  'Beverly Hills, CA',
  90,
  8
);