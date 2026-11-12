import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { TenantRepository, type TenantIdentityField, type TenantIdentityMatch } from '../../repositories/tenants'
import { TenantIdentityConflictLimitRepository } from '../../repositories/tenants/identity-conflict-limit'
import { AuditService } from '../audit'
import { TenantAuthorizationService } from './authorization'

export type TenantIdentitySource = 'create' | 'update' | 'import' | 'portal'
export interface TenantIdentityCandidate { phone?: string; idNumber?: string | null; excludeId?: string }

export const TENANT_IDENTITY_CONFLICT_MESSAGE = 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên'
const DUPLICATE_MESSAGES: Record<TenantIdentityField, string> = {
  phone: 'Số điện thoại đã tồn tại',
  id_number: 'Số CMND/CCCD đã tồn tại',
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback
}

function policy(event: H3Event) {
  const runtime = useRuntimeConfig(event) as Record<string, unknown>
  return {
    limit: bounded(runtime.tenantIdentityConflictLimit, 10, 1, 1_000),
    windowSeconds: bounded(runtime.tenantIdentityConflictWindowSeconds, 900, 60, 86_400),
  }
}

function subjectHash(user: AuthUser): string {
  return createHash('sha256').update(user.id).digest('hex')
}

function lookupOf(candidate: TenantIdentityCandidate) {
  return {
    phones: candidate.phone ? [candidate.phone] : [],
    idNumbers: candidate.idNumber ? [candidate.idNumber] : [],
    excludeId: candidate.excludeId,
  }
}

function genericConflict(): never {
  throw createError({
    statusCode: 409,
    data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: TENANT_IDENTITY_CONFLICT_MESSAGE } },
  })
}

function duplicateConflict(matches: TenantIdentityMatch[]): never {
  const fieldErrors: Partial<Record<TenantIdentityField, string[]>> = {}
  for (const match of matches) fieldErrors[match.field] = [DUPLICATE_MESSAGES[match.field]]
  throw createError({
    statusCode: 409,
    data: {
      error: {
        code: 'TENANT_DUPLICATE',
        message: DUPLICATE_MESSAGES[matches[0]!.field],
        details: { fieldErrors, existingTenantId: matches[0]!.tenantId },
      },
    },
  })
}

export const TenantIdentityConflictService = {
  async assertWithinLimit(event: H3Event, user: AuthUser): Promise<void> {
    const { limit, windowSeconds } = policy(event)
    const result = await TenantIdentityConflictLimitRepository.peek(event, { subjectHash: subjectHash(user), limit, windowSeconds })
    if (result.allowed) return
    setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      data: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau.',
          details: { retryable: true, retryAfterSeconds: result.retryAfterSeconds },
        },
      },
    })
  },

  async classify(
    event: H3Event,
    user: AuthUser,
    matches: TenantIdentityMatch[],
    source: TenantIdentitySource,
  ): Promise<{ specific: TenantIdentityMatch[]; generic: TenantIdentityMatch[] }> {
    if (!matches.length) return { specific: [], generic: [] }
    if (source === 'portal') return { specific: [], generic: matches }
    const contexts = await TenantAuthorizationService.resolveAccessMany(event, user, matches.map(match => match.tenantId))
    const specific = matches.filter(match => contexts.get(match.tenantId)?.level === 'full')
    return { specific, generic: matches.filter(match => !specific.includes(match)) }
  },

  async recordConflicts(
    event: H3Event,
    user: AuthUser,
    generic: TenantIdentityMatch[],
    source: TenantIdentitySource,
    units: number,
  ): Promise<void> {
    if (units < 1) return
    const { windowSeconds } = policy(event)
    await TenantIdentityConflictLimitRepository.record(event, { subjectHash: subjectHash(user), units, windowSeconds })
    const fieldsByTenant = new Map<string, TenantIdentityField[]>()
    for (const match of generic) {
      const fields = fieldsByTenant.get(match.tenantId) ?? []
      if (!fields.includes(match.field)) fields.push(match.field)
      fieldsByTenant.set(match.tenantId, fields)
    }
    for (const [tenantId, fields] of fieldsByTenant) {
      await AuditService.append(event, user, {
        building_id: null,
        action: AUDIT_ACTIONS.TENANT_IDENTITY_CONFLICT,
        entity_type: 'tenant',
        entity_id: tenantId,
        after_data: { fields, source },
      })
    }
  },

  async rejectMatches(event: H3Event, user: AuthUser, matches: TenantIdentityMatch[], source: TenantIdentitySource): Promise<void> {
    if (!matches.length) return
    const { specific, generic } = await this.classify(event, user, matches, source)
    await this.recordConflicts(event, user, generic, source, 1)
    if (generic.length) genericConflict()
    duplicateConflict(specific)
  },

  async assertAvailable(event: H3Event, user: AuthUser, candidate: TenantIdentityCandidate, source: TenantIdentitySource): Promise<void> {
    const lookup = lookupOf(candidate)
    if (!lookup.phones.length && !lookup.idNumbers.length) return
    await this.assertWithinLimit(event, user)
    await this.rejectMatches(event, user, await TenantRepository.findIdentityMatches(event, lookup), source)
  },

  async rejectUniqueViolation(event: H3Event, user: AuthUser, candidate: TenantIdentityCandidate, source: TenantIdentitySource): Promise<never> {
    await this.rejectMatches(event, user, await TenantRepository.findIdentityMatches(event, lookupOf(candidate)), source)
    await this.recordConflicts(event, user, [], source, 1)
    genericConflict()
  },
}
