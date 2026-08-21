import { throwConflict } from './errors'

export interface PaginationBounds {
  from: number
  to: number
}

/** Converts 1-based page/limit into inclusive Supabase `.range(from, to)` bounds. */
export function calculatePaginationBounds(page: number, limit: number): PaginationBounds {
  const from = (page - 1) * limit
  return { from, to: from + limit - 1 }
}

/** Throws a standard CONFLICT when a Postgres unique-violation (23505) is detected. */
export function throwIfUniqueViolation(error: unknown, message: string): void {
  if ((error as { code?: string } | null)?.code === '23505') throwConflict(message)
}
