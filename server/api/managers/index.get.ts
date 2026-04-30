import { serverSupabaseClient } from "#supabase/server";

interface ManagerRow {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
}

interface BuildingManagerRow {
  manager_id: string;
  building_id: string;
  permissions: string[];
  buildings: { id: string; name: string } | null;
}

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin");

  const client = await serverSupabaseClient(event);

  const { data: rawManagers, error } = await client
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "manager")
    .order("full_name");

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  const managers = rawManagers as unknown as ManagerRow[] | null;
  const managerIds = (managers ?? []).map((m) => m.id);

  const { data: rawGrants } = await client
    .from("building_managers")
    .select("manager_id, building_id, permissions, buildings(id, name)")
    .in("manager_id", managerIds as never);

  const grants = rawGrants as unknown as BuildingManagerRow[] | null;

  return (managers ?? []).map((m) => ({
    ...m,
    building_assignments: (grants ?? [])
      .filter((g) => g.manager_id === m.id)
      .map((g) => ({
        building_id: g.building_id,
        building_name: g.buildings?.name ?? "",
        permissions: g.permissions,
      })),
  }));
});
