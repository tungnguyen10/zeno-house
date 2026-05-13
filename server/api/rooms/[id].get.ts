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
  room_tenants: {
    tenant_id: string;
    move_out_date: string | null;
    profiles: { id: string; full_name: string | null } | null;
  }[];
}

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("rooms")
    .select(`
      id, building_id, room_number, floor, area, base_price, deposit_amount,
      max_occupants, status, description, thumbnail_url, created_at, updated_at,
      buildings(id, name),
      room_tenants(tenant_id, move_out_date, profiles(id, full_name))
    `)
    .eq("id", id)
    .is("room_tenants.move_out_date", null)
    .single() as { data: RoomRow | null; error: unknown };

  if (error) throw createError({ statusCode: 404, message: "Not found" });
  if (!data) throw createError({ statusCode: 404, message: "Not found" });

  const currentTenant = data.room_tenants?.[0]?.profiles ?? null;

  return {
    id: data.id,
    building_id: data.building_id,
    room_number: data.room_number,
    floor: data.floor,
    area: data.area,
    base_price: data.base_price,
    deposit_amount: data.deposit_amount,
    max_occupants: data.max_occupants,
    status: data.status,
    description: data.description,
    thumbnail_url: data.thumbnail_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
    building: data.buildings,
    current_tenant: currentTenant,
  };
});
