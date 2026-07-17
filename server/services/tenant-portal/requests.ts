import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { TenantSupportRequest } from '~/types/tenant-portal'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { mapTenantSupportRequest, type TenantSupportRequestRow } from '~/utils/mappers/tenant-portal'
import type { TENANT_DOCUMENT_MIME_TYPES } from '~/utils/validators/tenant-portal'
import { tenantSupportRequestCreateSchema } from '~/utils/validators/tenant-portal'
import { TenantDocumentRepository } from '../../repositories/tenant-portal/documents'
import { TenantSupportRequestRepository } from '../../repositories/tenant-portal/requests'
import { throwConflict, throwForbidden, throwInternal, throwValidationError } from '../../utils/errors'
import { can } from '../../utils/permissions'
import { getAssignedBuildingIds, resolveTenantId } from '../../utils/scope'
import { AuditService } from '../audit'

type TenantRequestAttachment = {
  name: string
  mimeType: string
  data: Buffer
}

export interface TenantSupportRequestSubmission {
  title: string
  description: string
  attachment?: TenantRequestAttachment
}

const EXTENSIONS: Record<(typeof TENANT_DOCUMENT_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

function todayInHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function withSignedAttachment(
  event: H3Event,
  row: TenantSupportRequestRow,
): Promise<TenantSupportRequest> {
  if (row.attachment_path) {
    const [tenantId, scope, objectName] = row.attachment_path.split('/')
    const isOwnedRequestPath = tenantId === row.tenant_id
      && scope === 'requests'
      && Boolean(objectName)
    if (!isOwnedRequestPath) {
      throwInternal(
        new Error(`Invalid attachment scope for support request ${row.id}`),
        'tenantPortal.requests.signAttachment',
      )
    }
  }
  const signedUrl = row.attachment_path
    ? await TenantDocumentRepository.createSignedUrl(event, row.attachment_path)
    : null
  return mapTenantSupportRequest(row, signedUrl)
}

function parseSubmission(input: TenantSupportRequestSubmission) {
  const attachment = input.attachment
    ? {
        name: input.attachment.name,
        mimeType: input.attachment.mimeType,
        size: input.attachment.data.length,
      }
    : undefined
  const parsed = tenantSupportRequestCreateSchema.safeParse({ ...input, attachment })
  if (!parsed.success) {
    throwValidationError('Yêu cầu hỗ trợ không hợp lệ', parsed.error.flatten())
  }
  return parsed.data
}

export const TenantSupportRequestService = {
  async list(event: H3Event, user: AuthUser): Promise<TenantSupportRequest[]> {
    if (!can(user, 'tenant.requests.read')) {
      throwForbidden('Không có quyền xem yêu cầu hỗ trợ')
    }
    const tenantId = await resolveTenantId(event, user)
    const rows = await TenantSupportRequestRepository.listByTenantId(event, tenantId)
    return Promise.all(rows.map(row => withSignedAttachment(event, row)))
  },

  async create(
    event: H3Event,
    user: AuthUser,
    input: TenantSupportRequestSubmission,
    today = todayInHoChiMinh(),
  ): Promise<TenantSupportRequest> {
    if (!can(user, 'tenant.requests.write')) {
      throwForbidden('Không có quyền tạo yêu cầu hỗ trợ')
    }
    const parsed = parseSubmission(input)
    const tenantId = await resolveTenantId(event, user)
    const context = await TenantSupportRequestRepository.findActiveContractContext(
      event,
      tenantId,
      today,
    )
    if (!context) throwConflict('Người thuê không có hợp đồng đang hoạt động')

    let attachmentPath: string | null = null
    if (input.attachment && parsed.attachment) {
      const extension = EXTENSIONS[parsed.attachment.mimeType]
      const requestedPath = `${tenantId}/requests/${randomUUID()}.${extension}`
      const uploaded = await TenantDocumentRepository.upload(event, requestedPath, {
        name: parsed.attachment.name,
        mimeType: parsed.attachment.mimeType,
        data: input.attachment.data,
      })
      attachmentPath = uploaded.path
    }

    let stored: TenantSupportRequestRow
    try {
      stored = await TenantSupportRequestRepository.create(event, {
        tenant_id: tenantId,
        building_id: context.buildingId,
        contract_id: context.contractId,
        title: parsed.title,
        description: parsed.description,
        attachment_path: attachmentPath,
      })
    }
    catch (error) {
      if (attachmentPath) await TenantDocumentRepository.remove(event, attachmentPath)
      throw error
    }

    const result = await withSignedAttachment(event, stored)
    await AuditService.append(event, user, {
      building_id: context.buildingId,
      action: AUDIT_ACTIONS.SUPPORT_REQUEST_CREATED,
      entity_type: 'support_request',
      entity_id: stored.id,
      after_data: result,
    })
    return result
  },

  async listForOperator(event: H3Event, user: AuthUser): Promise<TenantSupportRequest[]> {
    if (!can(user, 'tenants.read')) {
      throwForbidden('Không có quyền xem yêu cầu hỗ trợ')
    }
    const buildingIds = await getAssignedBuildingIds(event, user)
    const rows = await TenantSupportRequestRepository.listByBuildingIds(event, buildingIds)
    return Promise.all(rows.map(row => withSignedAttachment(event, row)))
  },
}
