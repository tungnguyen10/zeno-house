import { z } from "zod";
import { serverSupabaseClient } from "#supabase/server";

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  total_floors: z.number().int().min(1).max(200).optional(),
});

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Building ID required" });

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message });

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("buildings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, address, description, total_floors, created_at, updated_at")
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });
  if (!data) throw createError({ statusCode: 404, message: "Building not found" });

  return data;
});
