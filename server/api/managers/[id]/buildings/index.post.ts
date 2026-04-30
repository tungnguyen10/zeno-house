import { z } from "zod";
import { serverSupabaseClient } from "#supabase/server";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  permissions: z.array(z.enum(["rooms", "contracts", "invoices", "tenants", "utilities"])),
});

interface BuildingManagerRow {
  id: string;
  building_id: string;
  manager_id: string;
  permissions: string[];
  granted_by: string;
  granted_at: string;
}

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, "admin");

  const managerId = getRouterParam(event, "id");
  if (!managerId) {
    throw createError({ statusCode: 400, message: "Manager ID required" });
  }

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message });
  }

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("building_managers")
    .upsert(
      {
        building_id: parsed.data.building_id,
        manager_id: managerId,
        permissions: parsed.data.permissions,
        granted_by: user.id,
      } as never,
      { onConflict: "building_id,manager_id" },
    )
    .select()
    .single<BuildingManagerRow>();

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return data;
});
