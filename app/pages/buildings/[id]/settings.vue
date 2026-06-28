<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { ContractWithDetails } from '~/types/contracts'
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string

const { building, refresh: refreshBuilding } = useBuildingDetail(id)
const {
  services,
  isLoading: loadingServices,
  upsertService,
  updateService,
  syncToContracts,
} = useBuildingServices(id)
const {
  allServices: contractServices,
  isLoading: loadingContractServices,
  updateService: updateContractService,
  refresh: refreshContractServices,
} = useBuildingContractServices(id)

const { data: catalogData } = await useFetch<ApiSuccess<ServiceCatalogItem[]>>('/api/service-catalog')
const catalog = computed(() => catalogData.value?.data ?? [])

const { data: contractsData, refresh: refreshContracts } = await useFetch<ApiSuccess<ContractWithDetails[]>>(
  '/api/contracts',
  { query: { building_id: id, status: 'active', limit: 200 } },
)
const contractRows = computed(() =>
  (contractsData.value?.data ?? []).map(c => ({
    contractId: c.id,
    roomNumber: c.room.roomNumber,
    tenantName: c.tenant.fullName,
  })),
)

const activeServiceCount = computed(() => services.value.filter(s => s.isActive).length)

// Building code
const codeInput = ref('')
const isCodeLocked = computed(() => (building.value?.totalRooms ?? 0) > 0)
const isSavingCode = ref(false)
const codeSaveError = ref<string | null>(null)
const codeSaveSuccess = ref(false)
const codeDirty = computed(() => Boolean(codeInput.value) && codeInput.value !== building.value?.code)

watch(() => building.value?.code, (code) => {
  if (code) codeInput.value = code
}, { immediate: true })

async function handleSaveCode() {
  if (!codeDirty.value) return
  isSavingCode.value = true
  codeSaveError.value = null
  codeSaveSuccess.value = false
  try {
    await $fetch(`/api/buildings/${id}`, { method: 'PATCH', body: { code: codeInput.value } })
    await refreshBuilding()
    codeSaveSuccess.value = true
    setTimeout(() => { codeSaveSuccess.value = false }, 3000)
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message
    codeSaveError.value = msg ?? 'Không thể lưu code. Vui lòng thử lại.'
  }
  finally {
    isSavingCode.value = false
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
    await Promise.all([refreshContracts(), refreshContractServices()])
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
</script>

<template>
  <div class="space-y-8">
    <UiPageHeader title="Cài đặt dịch vụ" :description="building?.name">
      <NuxtLink
        :to="building ? buildingPath(building) : `/buildings/${id}`"
        class="text-sm text-muted hover:text-white transition-colors"
      >
        ← Quay lại tòa nhà
      </NuxtLink>
    </UiPageHeader>

    <!-- Building code -->
    <UiSection
      title="Mã tòa nhà"
      description="Dùng trong URL và tên hợp đồng. Khóa sau khi tòa nhà đã có phòng."
    >
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label class="flex-1 min-w-0">
            <span class="mb-1 block text-xs uppercase tracking-wide text-muted">Code</span>
            <input
              v-model="codeInput"
              type="text"
              :disabled="isCodeLocked"
              :title="isCodeLocked ? 'Không thể đổi vì tòa nhà đã có phòng' : undefined"
              class="block w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 font-mono text-sm text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="vd: zhpn"
            >
          </label>
          <div class="flex items-center gap-2 sm:pb-0.5">
            <UiButton
              v-if="!isCodeLocked"
              size="sm"
              :loading="isSavingCode"
              :disabled="!codeDirty"
              @click="handleSaveCode"
            >
              Lưu
            </UiButton>
            <span
              v-else
              class="inline-flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-deep/40 px-2 py-1 text-xs text-muted"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 1a4 4 0 0 0-4 4v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 7V5a2 2 0 1 0-4 0v3h4Z" clip-rule="evenodd" />
              </svg>
              Đã khóa · {{ building?.totalRooms }} phòng
            </span>
          </div>
        </div>
        <UiAlert v-if="codeSaveError" severity="danger" class="mt-3">
          {{ codeSaveError }}
        </UiAlert>
        <p v-if="codeSaveSuccess" class="mt-2 text-xs text-green-400">
          Code đã được lưu.
        </p>
      </div>
    </UiSection>

    <!-- Building-level defaults -->
    <UiSection
      title="Dịch vụ mặc định"
      description="Dịch vụ bật ở đây sẽ tự động thêm vào hợp đồng mới. Đơn giá là gợi ý — có thể chỉnh riêng từng phòng bên dưới."
    >
      <template #actions>
        <div class="flex items-center gap-3">
          <span
            v-if="syncResult"
            class="rounded-md bg-green-500/10 px-2 py-1 text-xs text-green-400"
          >
            {{ syncResult }}
          </span>
          <span
            v-else-if="activeServiceCount > 0"
            class="rounded-md bg-cyan/10 px-2 py-1 text-xs text-cyan"
          >
            {{ activeServiceCount }} dịch vụ đang bật
          </span>
          <UiButton
            size="sm"
            variant="secondary"
            :loading="isSyncing"
            :disabled="contractRows.length === 0"
            title="Cập nhật trạng thái bật/tắt dịch vụ trên tất cả hợp đồng active theo cấu hình mặc định. Không ghi đè giá và số lượng đã chỉnh riêng."
            @click="handleSync"
          >
            Đồng bộ xuống {{ contractRows.length }} hợp đồng
          </UiButton>
        </div>
      </template>
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <BuildingServiceSettings
          :building-id="id"
          :catalog="catalog"
          :services="services"
          :loading="loadingServices"
          @toggle="handleToggle"
          @update-amount="handleUpdateAmount"
          @update-pricing-type="handleUpdatePricingType"
        />
      </div>
    </UiSection>

    <!-- Per-contract overrides -->
    <UiSection
      title="Dịch vụ theo phòng"
      description="Bật/tắt, chỉnh đơn giá và số lượng riêng cho từng phòng. Thay đổi ở đây chỉ ảnh hưởng phòng đó."
    >
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <BuildingContractServicesList
          :contracts="contractRows"
          :services="contractServices"
          :loading="loadingContractServices"
          @update="updateContractService"
        />
      </div>
    </UiSection>
  </div>
</template>
