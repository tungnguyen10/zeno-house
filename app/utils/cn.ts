import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx (conditional classes) + tailwind-merge (conflict resolution).
 * Auto-imported by Nuxt — use `cn()` anywhere without importing.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
