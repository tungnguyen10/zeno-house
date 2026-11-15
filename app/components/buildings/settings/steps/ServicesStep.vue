<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import { getApiErrorMessage } from '~/utils/api-error'
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'

const source = useBuildingSettingsSource()
const id = source.id
const settings = source.settings
const contractRows = source.contractRows
const refreshSettings = source.refresh
const sharedSettingsSource = { status: source.status, error: source.error, refresh: source.refresh }
const authStore = useAuthStore()
const toast = useToast()

const {
  services,
  isLoading: loadingServices,
  upsertService,
  updateService,
  syncToContracts,
} = useBuildingServices(id, {
  ...sharedSettingsSource,
  data: computed(() => settings.value?.buildingServices ?? []),
})

const catalog = computed(() => settings.value?.catalog ?? [])
const refreshCatalog = refreshSettings

const servicePricingOptions: { value: PricingType, label: string }[] = [
  { value: 'fixed_per_room', label: 'Cố định / phòng' },
  { value: 'per_person', label: 'Theo người' },
  { value: 'per_vehicle', label: 'Theo xe' },
]
const customServiceModalOpen = ref(false)
const savingCustomService = ref(false)
const customServiceError = ref<string | null>(null)
const customServiceForm = reactive({
  name: '',
  pricing_type: 'fixed_per_room' as PricingType,
  unit: '',
  default_amount: '',
  is_active: true,
  description: '',
})

function openCustomServiceModal() {
  customServiceError.value = null
  customServiceForm.name = ''
  customServiceForm.pricing_type = 'fixed_per_room'
  customServiceForm.unit = ''
  customServiceForm.default_amount = ''
  customServiceForm.is_active = true
  customServiceForm.description = ''
  customServiceModalOpen.value = true
}

async function submitCustomService() {
  const amount = customServiceForm.default_amount === '' ? 0 : Number(customServiceForm.default_amount)
  if (!customServiceForm.name.trim() || !Number.isFinite(amount) || amount < 0) {
    customServiceError.value = 'Kiểm tra tên dịch vụ và đơn giá mặc định.'
    return
  }

  savingCustomService.value = true
  customServiceError.value = null
  try {
    const created = await apiFetch<ApiSuccess<ServiceCatalogItem>>('/api/service-catalog', {
      method: 'POST',
      body: {
        building_id: id,
        name: customServiceForm.name.trim(),
        pricing_type: customServiceForm.pricing_type,
        unit: customServiceForm.unit.trim() || null,
        description: customServiceForm.description.trim() || null,
      },
    })
    await upsertService({
      building_id: id,
      catalog_id: created.data.id,
      default_amount: amount,
      pricing_type: customServiceForm.pricing_type,
      is_active: customServiceForm.is_active,
    })
    await refreshCatalog()
    customServiceModalOpen.value = false
    toast.success('Đã thêm dịch vụ riêng.')
  }
  catch (err) {
    customServiceError.value = getApiErrorMessage(err, 'Không tạo được dịch vụ.')
  }
  finally {
    savingCustomService.value = false
  }
}

// Sync defaults to active contracts
const isSyncing = ref(false)
const syncResult = ref<string | null>(null)

async function handleSync() {
  isSyncing.value = true
  syncResult.value = null
  try {
    const changes = await syncToContracts(id)
    syncResult.value = changes > 0
      ? `Đã cập nhật ${changes} dịch vụ trên hợp đồng.`
      : 'Hợp đồng đã khớp với cấu hình mặc định.'
    await refreshSettings()
  }
  catch {
    syncResult.value = 'Đồng bộ thất bại.'
  }
  finally {
    isSyncing.value = false
    setTimeout(() => { syncResult.value = null }, 4000)
  }
}

async function handleToggle(catalogId: string, isActive: boolean) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { is_active: isActive })
  else await upsertService({ building_id: id, catalog_id: catalogId, is_active: isActive })
}

async function handleUpdateAmount(catalogId: string, amount: number) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { default_amount: amount })
  else await upsertService({ building_id: id, catalog_id: catalogId, default_amount: amount })
}

async function handleUpdatePricingType(catalogId: string, pricingType: PricingType) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { pricing_type: pricingType })
  else await upsertService({ building_id: id, catalog_id: catalogId, pricing_type: pricingType })
}

const canManageBuildingServices = computed(() => authStore.can('building-services.write'))

const activeServiceCount = computed(() => services.value.filter(s => s.isActive).length)
</script>

<template>
  <UiSection
    title="Dịch vụ mặc định"
    description="Dịch vụ bật ở đây sẽ tự động thêm vào hợp đồng mới. Đơn giá là gợi ý — có thể chỉnh riêng từng hợp đồng trong mục Nâng cao."
  >
    <template #actions>
      <div class="flex items-center gap-3">
        <span
          v-if="syncResult"
          class="rounded-md bg-status-success/10 px-2 py-1 text-xs text-status-success"
        >
          {{ syncResult }}
        </span>
        <span
          v-else-if="activeServiceCount > 0"
          class="rounded-md bg-ui-accent/10 px-2 py-1 text-xs text-ui-accent"
        >
          {{ activeServiceCount }} dịch vụ đang bật
        </span>
        <UiButton
          v-if="canManageBuildingServices"
          size="sm"
          variant="secondary"
          @click="openCustomServiceModal"
        >
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm dịch vụ
        </UiButton>
        <UiButton
          size="sm"
          variant="secondary"
          :loading="isSyncing"
          :disabled="contractRows.length === 0"
          title="Cập nhật trạng thái bật/tắt dịch vụ trên tất cả hợp đồng active theo cấu hình mặc định. Không ghi đè giá và số lượng đã chỉnh riêng."
          @click="handleSync"
        >
          {{ contractRows.length > 0 ? `Đồng bộ xuống ${contractRows.length} hợp đồng` : 'Chưa có hợp đồng để đồng bộ' }}
        </UiButton>
      </div>
    </template>
    <UiSurfacePanel density="compact">
      <BuildingServiceSettings
        :building-id="id"
        :catalog="catalog"
        :services="services"
        :loading="loadingServices"
        @toggle="handleToggle"
        @update-amount="handleUpdateAmount"
        @update-pricing-type="handleUpdatePricingType"
      />
    </UiSurfacePanel>
  </UiSection>

    <UiModal
      :open="customServiceModalOpen"
      title="Thêm dịch vụ riêng"
      size="md"
      @close="customServiceModalOpen = false"
    >
      <div class="space-y-4">
        <UiInput
          v-model="customServiceForm.name"
          label="Tên dịch vụ"
          placeholder="Ví dụ: Giặt sấy"
          required
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <UiSelect
            v-model="customServiceForm.pricing_type"
            label="Loại tính phí"
            :options="servicePricingOptions"
          />
          <UiInput
            v-model="customServiceForm.unit"
            label="Đơn vị"
            placeholder="lần, người, xe..."
          />
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <UiInput
            v-model="customServiceForm.default_amount"
            label="Đơn giá mặc định"
            type="number"
            number-mode="currency"
            placeholder="0"
          />
          <UiToggle
            v-model="customServiceForm.is_active"
            label="Kích hoạt ngay"
            size="sm"
            class="pb-2"
          />
        </div>
        <UiTextarea
          v-model="customServiceForm.description"
          label="Ghi chú"
          :rows="2"
          resize="none"
        />
        <UiAlert v-if="customServiceError" severity="danger">
          {{ customServiceError }}
        </UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="savingCustomService" @click="customServiceModalOpen = false">
          Hủy
        </UiButton>
        <UiButton :loading="savingCustomService" @click="submitCustomService">
          Lưu dịch vụ
        </UiButton>
      </template>
    </UiModal>
</template>
