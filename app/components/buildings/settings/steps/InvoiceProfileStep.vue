<script setup lang="ts">
import type { BuildingInvoiceProfileSaveInput } from '~/types/building-invoice-profile'

const emit = defineEmits<{ saved: [] }>()
const source = useBuildingSettingsSource()
const id = source.id
const settings = source.settings
const settingsData = source.settingsData
const settingsStatus = source.status
const settingsLoadError = source.error
const sharedSettingsSource = { status: source.status, error: source.error, refresh: source.refresh }
const authStore = useAuthStore()
const toast = useToast()

const {
  profile: invoiceProfile,
  loading: loadingInvoiceProfile,
  saving: savingInvoiceProfile,
  error: invoiceProfileError,
  save: saveInvoiceProfile,
} = useBuildingInvoiceProfile(id, {
  ...sharedSettingsSource,
  data: computed(() => settings.value?.invoiceProfile ?? null),
  set: (profile) => {
    if (settingsData.value) {
      settingsData.value = {
        ...settingsData.value,
        data: { ...settingsData.value.data, invoiceProfile: profile },
      }
    }
  },
})
const canEditInvoiceProfile = computed(() => authStore.can('building-invoice-profile.write'))
const {
  settings: invoiceEmailSettings,
  loading: loadingInvoiceEmailSettings,
  saving: savingInvoiceEmailSettings,
  error: invoiceEmailSettingsError,
  update: updateInvoiceEmailSettings,
} = useBuildingInvoiceEmailSettings(id, {
  status: settingsStatus,
  error: settingsLoadError,
  data: computed(() => settings.value?.invoiceEmailSettings ?? null),
  set: (emailSettings) => {
    if (settingsData.value) {
      settingsData.value = {
        ...settingsData.value,
        data: { ...settingsData.value.data, invoiceEmailSettings: emailSettings },
      }
    }
  },
})
const canEditInvoiceEmailSettings = computed(() => authStore.can('invoice-email-settings.write'))

async function handleSaveInvoiceProfile(input: BuildingInvoiceProfileSaveInput) {
  try {
    await saveInvoiceProfile(input)
    toast.success('Đã lưu thông tin nhận diện và thanh toán trên phiếu.')
    emit('saved')
  }
  catch {
    // The composable exposes the standardized API message beside the form.
  }
}

async function handleSaveInvoiceEmailSettings(enabled: boolean) {
  try {
    await updateInvoiceEmailSettings(enabled)
    toast.success(enabled ? 'Đã bật gửi hoá đơn tự động.' : 'Đã tắt gửi hoá đơn tự động.')
  }
  catch {
    // The composable surfaces the standardized error beside the control.
  }
}
</script>

<template>
  <UiSection
    title="Nhận diện & thanh toán trên phiếu"
    description="Logo, tài khoản nhận tiền và QR được lưu thành snapshot riêng trên từng hóa đơn khi phát hành."
  >
    <UiSurfacePanel density="compact">
      <BuildingInvoiceProfileSettings
        :profile="invoiceProfile"
        :can-edit="canEditInvoiceProfile"
        :loading="loadingInvoiceProfile"
        :saving="savingInvoiceProfile"
        :error="invoiceProfileError"
        @save="handleSaveInvoiceProfile"
      />
    </UiSurfacePanel>
  </UiSection>

  <UiSection
    title="Gửi hoá đơn qua email"
    description="Kiểm soát việc xếp hàng gửi email cho các hoá đơn mới của toà nhà."
  >
    <UiSurfacePanel density="compact">
      <BuildingInvoiceEmailSettings
        :settings="invoiceEmailSettings"
        :can-edit="canEditInvoiceEmailSettings"
        :loading="loadingInvoiceEmailSettings"
        :saving="savingInvoiceEmailSettings"
        :error="invoiceEmailSettingsError"
        @save="handleSaveInvoiceEmailSettings"
      />
    </UiSurfacePanel>
  </UiSection>
</template>
