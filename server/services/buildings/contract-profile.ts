import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingContractProfile, BuildingReadiness } from '~/types/building-contract-profile'
import { mapBuildingContractProfile, maskBuildingContractProfile, type BuildingContractProfileRow } from '~/utils/mappers/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingContractProfileRepository } from '../../repositories/building-contract-profiles'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { assertBuildingScope } from '../../utils/scope'
import { AuditService } from '../audit'
import { computeBuildingReadiness } from './readiness'

const EDITABLE_COLUMNS: (keyof BuildingContractProfileInput)[] = [
  'lessor_full_name', 'lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number',
  'lessor_id_issued_date', 'lessor_id_issued_place', 'lessor_phone', 'brand_name',
  'default_term_months', 'default_deposit_months', 'notice_days', 'deposit_refund_days', 'renewal_months',
  'extra_occupant_fee', 'drilling_fee', 'fingerprint_reset_fee', 'signed_copies', 'copies_per_party',
]

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

function changedFields(before: BuildingContractProfileRow | null, after: BuildingContractProfileInput): string[] {
  return EDITABLE_COLUMNS.filter((key) => {
    const prev = before?.[key as keyof BuildingContractProfileRow] ?? null
    const next = after[key] ?? null
    return String(prev) !== String(next)
  })
}

function present(user: AuthUser, profile: BuildingContractProfile | null) {
  if (!profile) return null
  return can(user, 'building-contract-profile.pii.read') ? profile : maskBuildingContractProfile(profile)
}

export const BuildingContractProfileService = {
  async get(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<BuildingContractProfile | null> {
    if (!can(user, 'building-contract-profile.read')) throwForbidden('Không có quyền xem thông tin hợp đồng của tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    const row = await BuildingContractProfileRepository.findByBuildingId(event, building.id)
    return present(user, row ? mapBuildingContractProfile(row) : null)
  },

  async save(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    input: BuildingContractProfileInput,
  ): Promise<BuildingContractProfile> {
    if (!can(user, 'building-contract-profile.write')) throwForbidden('Không có quyền cập nhật thông tin hợp đồng của tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const existing = await BuildingContractProfileRepository.findByBuildingId(event, building.id)
    const saved = await BuildingContractProfileRepository.upsert(event, building.id, input, user.id)

    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_CONTRACT_PROFILE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { changed_fields: changedFields(existing, input) },
    })
    return present(user, mapBuildingContractProfile(saved))!
  },

  async readiness(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<BuildingReadiness> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    const [row, invoiceProfile] = await Promise.all([
      BuildingContractProfileRepository.findByBuildingId(event, building.id),
      BuildingInvoiceProfileRepository.findByBuildingId(event, building.id),
    ])
    return computeBuildingReadiness(building, row ? mapBuildingContractProfile(row) : null, Boolean(invoiceProfile))
  },

  async getUnmaskedForServer(event: H3Event, buildingId: string): Promise<BuildingContractProfile | null> {
    const row = await BuildingContractProfileRepository.findByBuildingId(event, buildingId)
    return row ? mapBuildingContractProfile(row) : null
  },
}
