import { z } from "zod";
import { serverSupabaseClient } from "#supabase/server";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  total_floors: z.number().int().min(1).max(200).default(1),
});

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message });

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("buildings")
    .insert(parsed.data)
    .select("id, name, address, description, total_floors, created_at, updated_at")
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data;
});
