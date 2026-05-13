import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  const client = await serverSupabaseClient(event);

  const { count } = await client
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id)
    .in("status", ["active", "pending", "pending_signature"]);

  if ((count ?? 0) > 0) {
    throw createError({ statusCode: 409, message: "rooms.delete_blocked" });
  }

  const { error } = await client.from("rooms").delete().eq("id", id);

  if (error) throw createError({ statusCode: 500, message: error.message });

  return { success: true };
});
