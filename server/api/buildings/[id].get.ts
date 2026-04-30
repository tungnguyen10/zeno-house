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

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Building ID required" });

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("buildings")
    .select("id, name, address, description, total_floors, created_at, updated_at, rooms(status)")
    .eq("id", id)
    .single() as { data: BuildingRow | null; error: unknown };

  if (error) throw createError({ statusCode: 404, message: "Building not found" });
  if (!data) throw createError({ statusCode: 404, message: "Building not found" });

  return {
    id: data.id,
    name: data.name,
    address: data.address,
    description: data.description,
    total_floors: data.total_floors,
    created_at: data.created_at,
    updated_at: data.updated_at,
    stats: {
      total_rooms: data.rooms.length,
      available_rooms: data.rooms.filter((r) => r.status === "available").length,
      occupied_rooms: data.rooms.filter((r) => r.status === "occupied").length,
    },
  };
});
