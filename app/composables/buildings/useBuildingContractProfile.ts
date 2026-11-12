import type { ApiSuccess } from '~/types/api'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { getApiErrorMessage } from '~/utils/api-error'

export function useBuildingContractProfile(
  buildingIdentifier: MaybeRef<string>,
  source: {
    data: Readonly<Ref<BuildingContractProfile | null>>
    set: (profile: BuildingContractProfile) => void
    onSaved?: () => Promise<unknown>
  },
) {
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(input: BuildingContractProfileInput): Promise<BuildingContractProfile> {
    error.value = null
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<BuildingContractProfile>>(
        `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/contract-profile`,
        { method: 'PUT', body: input },
      )
      source.set(response.data)
      await source.onSaved?.()
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể lưu thông tin hợp đồng. Vui lòng thử lại.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  return { profile: source.data, saving, error, save }
}
