import { z } from 'zod'

/** Normalizes a single value or array into an array (or undefined). */
export const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

/** Optional string that trims and treats empty input as undefined. */
export const trimmedOptionalString = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).optional(),
)

/** Optional free-text search query used by list endpoints. */
export const searchQuerySchema = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).max(100).optional(),
)

/** 1-based page number, defaults to 1. */
export const pageSchema = z.coerce.number().int().min(1).optional().default(1)

/** Sort order shared across list endpoints. */
export const orderSchema = z.enum(['asc', 'desc'])

/** Page size schema with a configurable maximum, defaults to 20. */
export const limitSchema = (max = 200) =>
  z.coerce.number().int().min(1).max(max).optional().default(20)
