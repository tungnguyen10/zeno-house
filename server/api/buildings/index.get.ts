import { serverSupabaseClient } from "#supabase/server";

interface RoomRow { status: string; }
interface BuildingRow {
  id: string;
  name: string;
  address: string;
  description: string | null;
  total_floors: number;
  created_at: string;
  updated_at: string;
  rooms: RoomRow[];
}

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("buildings")
    .select("id, name, address, description, total_floors, created_at, updated_at, rooms(status)")
    .order("name") as { data: BuildingRow[] | null; error: unknown };

  if (error) throw createError({ statusCode: 500, message: (error as { message: string }).message });

  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    description: b.description,
    total_floors: b.total_floors,
    created_at: b.created_at,
    updated_at: b.updated_at,
    stats: {
      total_rooms: b.rooms.length,
      available_rooms: b.rooms.filter((r) => r.status === "available").length,
      occupied_rooms: b.rooms.filter((r) => r.status === "occupied").length,
    },
  }));
});
