-- Migration: Drop total_rooms column from buildings
-- total_rooms is now computed at query time via LEFT JOIN COUNT on rooms table
-- to avoid data drift (static column not auto-synced with rooms INSERT/DELETE)

begin;

alter table public.buildings drop column if exists total_rooms;

commit;
