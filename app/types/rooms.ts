import { z } from "zod";

export type RoomStatus = "available" | "occupied" | "maintenance" | "reserved";

export interface Room {
  id: string;
  building_id: string;
  room_number: string;
  floor: number | null;
  area: number | null;
  base_price: number;
  deposit_amount: number;
  max_occupants: number;
  status: RoomStatus;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  building?: { id: string; name: string };
  current_tenant?: { id: string; full_name: string | null } | null;
}

export const createRoomSchema = z.object({
  building_id: z.string().uuid(),
  room_number: z.string().min(1).max(50),
  floor: z.number().int().min(0).max(200).optional(),
  area: z.number().positive().optional(),
  base_price: z.number().positive(),
  deposit_amount: z.number().min(0).default(0),
  max_occupants: z.number().int().min(1).default(1),
  status: z.enum(["available", "occupied", "maintenance", "reserved"]).default("available"),
  description: z.string().max(1000).optional(),
  thumbnail_url: z.string().nullable().optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
