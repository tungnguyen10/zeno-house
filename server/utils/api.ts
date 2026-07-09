import type { H3Event } from 'h3'
import type { z } from 'zod'
import type { ApiSuccess } from '~/types/api'

/**
 * Read and validate the request body against a Zod schema.
 *
 * On failure, throws the standard `VALIDATION_ERROR` envelope with `error.flatten()`
 * as `details` (preserving `fieldErrors`/`formErrors` that the client relies on).
 */
export async function parseBody<Schema extends z.ZodTypeAny>(
  event: H3Event,
  schema: Schema,
  message = 'Dữ liệu không hợp lệ',
): Promise<z.infer<Schema>> {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    throwValidationError(message, result.error.flatten())
  }
  return result.data
}

/**
 * Read and validate the request query string against a Zod schema.
 *
 * On failure, throws the standard `VALIDATION_ERROR` envelope with `error.flatten()` as `details`.
 */
export function parseQuery<Schema extends z.ZodTypeAny>(
  event: H3Event,
  schema: Schema,
  message = 'Tham số truy vấn không hợp lệ',
): z.infer<Schema> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError(message, result.error.flatten())
  }
  return result.data
}

/**
 * Build the standard success envelope `{ data, meta? }`.
 */
export function ok<T, M extends Record<string, unknown> = Record<string, unknown>>(
  data: T,
  meta?: M,
): ApiSuccess<T, M> {
  return meta ? { data, meta } : { data }
}

interface PaginationInput {
  total: number
  page: number
  limit: number
}

interface PaginationMeta extends Record<string, unknown> {
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Build the standard paginated envelope `{ data, meta: { total, page, limit, totalPages } }`.
 */
export function paginated<T>(items: T[], pagination: PaginationInput): ApiSuccess<T[], PaginationMeta> {
  const { total, page, limit } = pagination
  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
