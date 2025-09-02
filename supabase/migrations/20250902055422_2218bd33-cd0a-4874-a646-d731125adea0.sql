-- Insert sample guard location data for testing with actual guard IDs
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
  '0efc4bc5-f99f-4b05-a41f-3ea1c286216d',
  'f53afed0-e917-4861-a0c2-0865a5147811',
  34.0522, 
  -118.2437, 
  'Downtown Los Angeles, CA',
  85,
  10
),
-- Najib khan's location (active shift) 
(
  '070783a0-0fb3-4cf2-bf3d-3e6ad3025411',
  '35c4d400-62ec-4bec-a7fb-7c2489f4f77d',
  'e327038f-4f88-4ea3-9e84-257e302f0fcf',
  34.1030, 
  -118.2693, 
  'Beverly Hills, CA',
  90,
  8
);