-- Migration: Drop room_assignments table
-- room_assignments is superseded by contracts.
-- room.status is now driven by contract lifecycle (active → occupied, terminated/expired → available).

begin;

drop table if exists public.room_assignments cascade;

commit;
