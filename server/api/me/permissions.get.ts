import { serverSupabaseClient } from "#supabase/server";
import type { Role } from "~/types";

interface BuildingManagerRow {
  building_id: string;
  permissions: string[];
  buildings: { name: string } | null;
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event);

  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: Role } | null; error: unknown };

  if (!profile) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  if (profile.role === "admin") {
    return { isAdmin: true };
  }

  const { data: rawGrants, error } = await client
    .from("building_managers")
    .select("building_id, permissions, buildings(name)")
    .eq("manager_id", user.id as never);

  const grants = rawGrants as unknown as BuildingManagerRow[] | null;

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return (grants ?? []).map((g) => ({
    building_id: g.building_id,
    building_name: g.buildings?.name ?? "",
    permissions: g.permissions,
  }));
});
