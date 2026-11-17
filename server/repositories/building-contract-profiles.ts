import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { BuildingContractProfileRow } from '~/utils/mappers/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import type { Database } from '~/types/database.types'

const table = (event: H3Event) => db(event).from('building_contract_profiles')

export const BuildingContractProfileRepository = {
  async findByBuildingId(event: H3Event, buildingId: string): Promise<BuildingContractProfileRow | null> {
    const { data, error } = await table(event).select('*').eq('building_id', buildingId).maybeSingle()
    if (error) throwDbError(error, 'buildingContractProfile.findByBuildingId')
    return data as BuildingContractProfileRow | null
  },

  async upsert(
    event: H3Event,
    buildingId: string,
    input: BuildingContractProfileInput,
    actorId: string,
  ): Promise<BuildingContractProfileRow> {
    const { data, error } = await table(event)
      // `lessor_email` is in the DB (Task 1) but missing from the generated Insert type until Task 12 regenerates it.
      .upsert(
        { building_id: buildingId, ...input, updated_by: actorId } as Database['public']['Tables']['building_contract_profiles']['Insert'],
        { onConflict: 'building_id' },
      )
      .select('*')
      .single()
    if (error) {
      // A check-constraint violation (23514) carries the failing row in its text; never
      // forward it so the lessor's personal data cannot leak through an error message.
      if ((error as { code?: string }).code === '23514') {
        throwValidationError('Thông tin hợp đồng không hợp lệ')
      }
      throwDbError(error, 'buildingContractProfile.upsert')
    }
    return data as BuildingContractProfileRow
  },
}
