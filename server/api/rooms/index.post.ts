import { z } from "zod";
import { serverSupabaseClient } from "#supabase/server";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  room_number: z.string().min(1).max(50),
  floor: z.number().int().min(0).max(200).nullable().optional(),
  area: z.number().positive().nullable().optional(),
  base_price: z.number().positive(),
  deposit_amount: z.number().min(0).default(0),
  max_occupants: z.number().int().min(1).default(1),
  status: z.enum(["available", "occupied", "maintenance", "reserved"]).default("available"),
  description: z.string().max(1000).nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  await requireRole(event, "admin", "manager");

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message });

  const client = await serverSupabaseClient(event);

  const { data, error } = await client
    .from("rooms")
    .insert(parsed.data as unknown as never)
    .select("id, building_id, room_number, floor, area, base_price, deposit_amount, max_occupants, status, description, thumbnail_url, created_at, updated_at")
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data;
});
