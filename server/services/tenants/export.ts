import type { H3Event } from 'h3'
import ExcelJS from 'exceljs'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { slugifyName } from '~/utils/format/slug'
import { BuildingRepository } from '../../repositories/buildings'
import { AuditRepository } from '../../repositories/audit'
import { TenantExportRepository, type TenantExportAssignment } from '../../repositories/tenants/export'
import { vietnamDateISO } from '../../utils/date'
import { styleMetaRow, styleTableHeaderRow, styleTableRow, styleTitleRow } from '../../utils/excel'
import { requireCapability } from '../../utils/permissions'
import { getVisibleBuildingIds } from '../../utils/scope'

export interface TenantExportCandidate {
  id: string
  code: string
  fullName: string
  phone: string
  roomNumbers: string[]
  roles: Array<'primary' | 'roommate'>
}

function sortedCandidates(assignments: TenantExportAssignment[], tenants: Tenant[]): TenantExportCandidate[] {
  const tenantById = new Map(tenants.map(tenant => [tenant.id, tenant]))
  return assignments.flatMap((assignment) => {
    const tenant = tenantById.get(assignment.tenantId)
    if (!tenant) return []
    return [{
      id: tenant.id,
      code: tenant.code,
      fullName: tenant.fullName,
      phone: tenant.phone,
      roomNumbers: assignment.roomNumbers,
      roles: assignment.roles,
    }]
  }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi') || a.code.localeCompare(b.code, 'vi'))
}

async function resolveBuilding(event: H3Event, user: AuthUser, buildingId: string) {
  requireCapability(user, 'tenants.export', 'Không có quyền xuất danh sách khách thuê')
  const visibleIds = await getVisibleBuildingIds(event, user)
  if (visibleIds && !visibleIds.includes(buildingId)) throwNotFound('Không tìm thấy tòa nhà')
  const building = await BuildingRepository.findByIdentifier(event, buildingId)
  if (!building || building.id !== buildingId) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

const columns = [
  ['Mã khách', 19], ['Họ tên', 28], ['Số điện thoại', 18], ['Email', 29],
  ['Phòng hiện tại', 18], ['Vai trò', 17], ['Trạng thái', 17], ['CMND/CCCD', 22],
  ['Ngày sinh', 16], ['Giới tính', 15], ['Nghề nghiệp', 22], ['Ngày cấp', 16],
  ['Nơi cấp', 24], ['Địa chỉ thường trú', 34], ['Liên hệ khẩn cấp', 25],
  ['SĐT liên hệ khẩn cấp', 22], ['Ghi chú', 34],
] as const

function roleLabel(roles: TenantExportAssignment['roles']): string {
  return roles.map(role => role === 'primary' ? 'Đứng tên hợp đồng' : 'Người ở cùng').join(', ')
}

function genderLabel(gender: string | null): string {
  if (gender === 'male') return 'Nam'
  if (gender === 'female') return 'Nữ'
  if (gender === 'other') return 'Khác'
  return ''
}

export const TenantExportService = {
  async listCandidates(event: H3Event, user: AuthUser, buildingId: string): Promise<TenantExportCandidate[]> {
    await resolveBuilding(event, user, buildingId)
    const assignments = await TenantExportRepository.listCurrentAssignments(event, buildingId, vietnamDateISO())
    const tenants = await TenantExportRepository.findTenants(event, assignments.map(row => row.tenantId))
    return sortedCandidates(assignments, tenants)
  },

  async buildWorkbook(event: H3Event, user: AuthUser, input: { building_id: string; tenant_ids: string[] }): Promise<{ buffer: Buffer; fileName: string }> {
    const building = await resolveBuilding(event, user, input.building_id)
    const selectedIds = [...new Set(input.tenant_ids)]
    if (selectedIds.length === 0) throwValidationError('Cần chọn ít nhất một khách thuê')
    const assignments = await TenantExportRepository.listCurrentAssignments(event, building.id, vietnamDateISO())
    const assignmentById = new Map(assignments.map(row => [row.tenantId, row]))
    if (selectedIds.some(id => !assignmentById.has(id))) {
      throwConflict('Danh sách khách đang ở đã thay đổi. Vui lòng chọn lại khách cần xuất.', { reason: 'TENANT_EXPORT_SELECTION_STALE' })
    }
    const tenants = await TenantExportRepository.findTenants(event, selectedIds)
    if (tenants.length !== selectedIds.length) {
      throwConflict('Danh sách khách thuê đã thay đổi. Vui lòng chọn lại khách cần xuất.', { reason: 'TENANT_EXPORT_SELECTION_STALE' })
    }
    const selected = sortedCandidates(assignments.filter(row => selectedIds.includes(row.tenantId)), tenants)
    const tenantById = new Map(tenants.map(tenant => [tenant.id, tenant]))

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Zeno House'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Khách thuê')
    sheet.columns = columns.map(([, width]) => ({ width }))
    sheet.mergeCells(1, 1, 1, columns.length)
    sheet.getCell(1, 1).value = 'DANH SÁCH KHÁCH THUÊ'
    styleTitleRow(sheet.getRow(1), 18)
    sheet.getRow(1).height = 38
    sheet.mergeCells(2, 1, 2, columns.length)
    sheet.getCell(2, 1).value = `${building.name} · ${selected.length} khách · ${vietnamDateISO()}`
    styleMetaRow(sheet.getRow(2), 15)
    sheet.getRow(2).height = 30
    sheet.getRow(3).values = columns.map(([header]) => header)
    styleTableHeaderRow(sheet.getRow(3), columns.length)
    sheet.views = [{ state: 'frozen', ySplit: 3 }]
    sheet.autoFilter = { from: 'A3', to: `Q${Math.max(4, selected.length + 3)}` }

    for (const [index, candidate] of selected.entries()) {
      const tenant = tenantById.get(candidate.id)!
      const assignment = assignmentById.get(candidate.id)!
      const row = sheet.getRow(index + 4)
      row.values = [
        tenant.code, tenant.fullName, tenant.phone, tenant.email ?? '',
        assignment.roomNumbers.join(', '), roleLabel(assignment.roles),
        tenant.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động', tenant.idNumber ?? '',
        tenant.dateOfBirth ?? '', genderLabel(tenant.gender), tenant.occupation ?? '',
        tenant.idIssuedDate ?? '', tenant.idIssuedPlace ?? '', tenant.permanentAddress ?? '',
        tenant.emergencyContactName ?? '', tenant.emergencyContactPhone ?? '', tenant.notes ?? '',
      ]
      styleTableRow(row, false, columns.length)
      row.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      row.eachCell({ includeEmpty: true }, cell => { cell.alignment = row.alignment })
      for (const cellIndex of [3, 8, 16]) row.getCell(cellIndex).numFmt = '@'
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    await AuditRepository.append(event, {
      building_id: building.id,
      actor_id: user.id,
      action: AUDIT_ACTIONS.TENANT_EXPORTED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { tenant_count: selectedIds.length, tenant_ids: selectedIds, format: 'xlsx' },
    })
    return { buffer, fileName: `tenants-${slugifyName(building.name) || building.id}-${vietnamDateISO()}.xlsx` }
  },
}
