import { serverSupabaseClient } from "#supabase/server";

interface RoomRow {
  id: string;
  building_id: string;
  room_number: string;
  floor: number | null;
  area: number | null;
  base_price: number;
  deposit_amount: number;
  max_occupants: number;
  status: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  buildings: { id: string; name: string } | null;
}

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const query = getQuery(event);
  const buildingId = query.building_id as string | undefined;
  const status = query.status as string | undefined;
  const floor = query.floor !== undefined ? Number(query.floor) : undefined;

  const client = await serverSupabaseClient(event);

  let q = client
    .from("rooms")
    .select("id, building_id, room_number, floor, area, base_price, deposit_amount, max_occupants, status, description, thumbnail_url, created_at, updated_at, buildings(id, name)")
    .order("room_number");

  if (buildingId) q = q.eq("building_id", buildingId);
  if (status) q = q.eq("status", status);
  if (floor !== undefined && !isNaN(floor)) q = q.eq("floor", floor);

  const { data, error } = await q as { data: RoomRow[] | null; error: unknown };

  if (error) throw createError({ statusCode: 500, message: (error as { message: string }).message });

  return (data ?? []).map((r) => ({
    ...r,
    building: r.buildings,
    buildings: undefined,
  }));
});
