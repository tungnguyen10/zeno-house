import { z } from 'zod'
import { VALIDATION_MESSAGES } from './messages'

/** Shared password constraints (8–72 chars) used across auth/user/tenant flows. */
export const passwordSchema = z
  .string()
  .min(8, VALIDATION_MESSAGES.passwordMin)
  .max(72, VALIDATION_MESSAGES.passwordMax)
