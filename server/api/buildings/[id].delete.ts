import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Building ID required" });

  const client = await serverSupabaseClient(event);

  const { count } = await client
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("building_id", id);

  if (count && count > 0) {
    throw createError({ statusCode: 409, message: "buildings.delete_blocked" });
  }

  const { error } = await client.from("buildings").delete().eq("id", id);

  if (error) throw createError({ statusCode: 500, message: error.message });

  return { ok: true };
});
