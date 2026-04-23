import type { H3Event } from "h3";
import type { User } from "@supabase/supabase-js";
import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server";
import type { Role } from "~/types";

export async function requireRole(
  event: H3Event,
  ...roles: Role[]
): Promise<{ user: User; role: Role }> {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const client = serverSupabaseServiceRole(event);
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: Role }>();

  if (!profile || !roles.includes(profile.role)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  return { user, role: profile.role };
}
