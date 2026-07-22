import type { ApiSuccess } from '~/types/api'
import type {
  BuildingInvoiceProfile,
  BuildingInvoiceProfileSaveInput,
} from '~/types/building-invoice-profile'
import { getApiErrorMessage } from '~/utils/api-error'

interface BuildingInvoiceProfileSource {
  data: Readonly<Ref<BuildingInvoiceProfile | null>>
  status: Readonly<Ref<string>>
  error: Readonly<Ref<unknown>>
  refresh: () => Promise<unknown>
  set: (profile: BuildingInvoiceProfile) => void
}

export function useBuildingInvoiceProfile(
  buildingIdentifier: MaybeRef<string>,
  source?: BuildingInvoiceProfileSource,
) {
  const endpoint = () => `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/invoice-profile`
  const fetched = source
    ? null
    : useFetch<ApiSuccess<BuildingInvoiceProfile | null>>(
        endpoint,
        { watch: [() => toValue(buildingIdentifier)] },
      )
  const status = source?.status ?? fetched!.status
  const loadError = source?.error ?? fetched!.error
  const refresh = source?.refresh ?? fetched!.refresh
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  const profile = source?.data ?? computed(() => fetched?.data.value?.data ?? null)
  const loading = computed(() => status.value === 'pending')
  const error = computed(() => {
    if (saveError.value) return saveError.value
    return loadError.value
      ? getApiErrorMessage(loadError.value, 'Không thể tải thông tin nhận tiền của tòa nhà.')
      : null
  })

  async function save(input: BuildingInvoiceProfileSaveInput): Promise<BuildingInvoiceProfile> {
    saveError.value = null
    saving.value = true
    const body = new FormData()
    body.set('bank_name', input.bankName)
    body.set('account_holder', input.accountHolder)
    body.set('account_number', input.accountNumber)
    body.set('transfer_content_template', input.transferContentTemplate)
    body.set('remove_logo', String(input.removeLogo))
    if (input.qrImage) body.set('qr_image', input.qrImage)
    if (input.logoImage) body.set('logo_image', input.logoImage)

    try {
      const response = await apiFetch<ApiSuccess<BuildingInvoiceProfile>>(endpoint(), {
        method: 'PUT',
        body,
      })
      if (source) source.set(response.data)
      else fetched!.data.value = response
      return response.data
    }
    catch (cause) {
      saveError.value = getApiErrorMessage(cause, 'Không thể lưu thông tin nhận tiền. Vui lòng thử lại.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  return { profile, loading, saving, error, refresh, save }
}
