import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin");

  const managerId = getRouterParam(event, "id");
  const buildingId = getRouterParam(event, "buildingId");

  if (!managerId || !buildingId) {
    throw createError({ statusCode: 400, message: "Manager ID and Building ID required" });
  }

  const client = await serverSupabaseClient(event);

  const { error } = await client
    .from("building_managers")
    .delete()
    .eq("manager_id", managerId as never)
    .eq("building_id", buildingId as never);

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { ok: true };
});
