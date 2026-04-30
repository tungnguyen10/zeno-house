import { serverSupabaseClient } from "#supabase/server";

interface ContractRow {
  start_date: string;
  end_date: string;
  rooms: {
    room_number: string;
    floor: number | null;
    buildings: { name: string } | null;
  } | null;
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event);

  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const { data, error } = await client
    .from("contracts")
    .select("start_date, end_date, rooms(room_number, floor, buildings(name))")
    .eq("tenant_id", user.id)
    .in("status", ["active", "renewed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: ContractRow | null; error: unknown };

  if (error) {
    throw createError({ statusCode: 500, message: String(error) });
  }

  if (!data || !data.rooms) return null;

  return {
    room_number: data.rooms.room_number,
    building_name: data.rooms.buildings?.name ?? "",
    floor: data.rooms.floor,
    contract_start_date: data.start_date,
    contract_end_date: data.end_date,
  };
});
