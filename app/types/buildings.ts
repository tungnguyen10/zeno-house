import { z } from "zod";

export interface BuildingStats {
  total_rooms: number;
  available_rooms: number;
  occupied_rooms: number;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  description: string | null;
  total_floors: number;
  created_at: string;
  updated_at: string;
  stats?: BuildingStats;
}

export const createBuildingSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  total_floors: z.number().int().min(1).max(200).default(1),
});

export const updateBuildingSchema = createBuildingSchema.partial();

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
