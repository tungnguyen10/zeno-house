import type { H3Event } from 'h3'
import { db } from '../utils/db'
import { throwDbError, throwValidationError } from '../utils/errors'
import type { BuildingContractProfileRow } from '~/utils/mappers/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'

// Cast only at the boundary until cloud migration/type regeneration is complete.
const table = (event: H3Event) => db(event).from('building_contract_profiles' as never)

function failSafely(error: unknown, operation: string): never {
  // PostgreSQL messages, details and hints can contain submitted identity values.
  // Pass only a bounded database code to the shared logger/error translator.
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : null
  const code = typeof rawCode === 'string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(rawCode) ? rawCode : undefined
  if (code === '23514') throwValidationError('Thông tin hợp đồng không hợp lệ')
  throwDbError(code ? { code } : {}, operation)
}

export const BuildingContractProfileRepository = {
  async findByBuildingId(event: H3Event, buildingId: string): Promise<BuildingContractProfileRow | null> {
    let response
    try {
      response = await table(event).select('*').eq('building_id', buildingId).maybeSingle()
    }
    catch (error) {
      failSafely(error, 'buildingContractProfile.findByBuildingId')
    }
    if (response.error) failSafely(response.error, 'buildingContractProfile.findByBuildingId')
    return response.data as BuildingContractProfileRow | null
  },

  async upsert(
    event: H3Event,
    buildingId: string,
    input: BuildingContractProfileInput,
    actorId: string,
  ): Promise<BuildingContractProfileRow> {
    let response
    try {
      response = await table(event)
        .upsert({ building_id: buildingId, ...input, updated_by: actorId } as never, { onConflict: 'building_id' })
        .select('*')
        .single()
    }
    catch (error) {
      failSafely(error, 'buildingContractProfile.upsert')
    }
    if (response.error) failSafely(response.error, 'buildingContractProfile.upsert')
    return response.data as BuildingContractProfileRow
  },
}
