import type { H3Event } from "h3";
import type { User } from "@supabase/supabase-js";
import { serverSupabaseClient } from "#supabase/server";
import type { Role } from "~/types";

export async function requireRole(
  event: H3Event,
  ...roles: Role[]
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

  if (!profile || !roles.includes(profile.role)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  return { user: user as unknown as User, role: profile.role };
}
