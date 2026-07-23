import type { ApiSuccess } from '~/types/api'
import type { BuildingInvoiceEmailSettings } from '~/types/invoice-email'
import { getApiErrorMessage } from '~/utils/api-error'

interface SettingsSource {
  data: Readonly<Ref<BuildingInvoiceEmailSettings | null>>
  status: Readonly<Ref<string>>
  error: Readonly<Ref<unknown>>
  set: (settings: BuildingInvoiceEmailSettings) => void
}

export function useBuildingInvoiceEmailSettings(
  buildingIdentifier: MaybeRef<string>,
  source?: SettingsSource,
) {
  const endpoint = () =>
    `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/invoice-email-settings`
  const fetched = source
    ? null
    : useFetch<ApiSuccess<BuildingInvoiceEmailSettings>>(endpoint, {
        watch: [() => toValue(buildingIdentifier)],
      })
  const settings = source?.data ?? computed(() => fetched?.data.value?.data ?? null)
  const status = source?.status ?? fetched!.status
  const loadError = source?.error ?? fetched!.error
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const error = computed(() => saveError.value ?? (
    loadError.value
      ? getApiErrorMessage(loadError.value, 'Không thể tải cấu hình gửi email.')
      : null
  ))

  async function update(autoSendEnabled: boolean): Promise<BuildingInvoiceEmailSettings> {
    if (saving.value) throw new Error('INVOICE_EMAIL_SETTINGS_IN_FLIGHT')
    saving.value = true
    saveError.value = null
    try {
      const response = await apiFetch<ApiSuccess<BuildingInvoiceEmailSettings>>(endpoint(), {
        method: 'PUT',
        body: { auto_send_enabled: autoSendEnabled },
      })
      if (source) source.set(response.data)
      else fetched!.data.value = response
      return response.data
    }
    catch (cause) {
      saveError.value = getApiErrorMessage(cause, 'Không thể lưu cấu hình gửi email.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  return {
    settings,
    loading: computed(() => status.value === 'pending'),
    saving,
    error,
    update,
  }
}
