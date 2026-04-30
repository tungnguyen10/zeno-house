import type { H3Event } from "h3";
import type { User } from "@supabase/supabase-js";
import { serverSupabaseClient } from "#supabase/server";
import type { Role } from "~/types";

export async function requireBuildingPermission(
  event: H3Event,
  buildingId: string,
  feature: string,
): Promise<{ user: User; role: Role }> {
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
    return { user: user as unknown as User, role: profile.role };
  }

  if (profile.role !== "manager") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const { data: grant } = await client
    .from("building_managers")
    .select("id")
    .eq("building_id", buildingId)
    .eq("manager_id", user.id)
    .contains("permissions", [feature])
    .maybeSingle();

  if (!grant) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  return { user: user as unknown as User, role: profile.role };
}
