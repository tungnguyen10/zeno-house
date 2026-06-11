<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { ContractWithDetails } from '~/types/contracts'

const route = useRoute()
const id = route.params.id as string

const { building } = useBuildingDetail(id)
const { services, isLoading: loadingServices, upsertService, updateService, syncToContracts } = useBuildingServices(id)
const { allServices: contractServices, isLoading: loadingMatrix, updateService: updateContractService, refresh: refreshMatrix } = useBuildingContractServices(id)

const { data: catalogData } = await useFetch<ApiSuccess<ServiceCatalogItem[]>>('/api/service-catalog')
const catalog = computed(() => catalogData.value?.data ?? [])

// Fetch active contracts for this building (for matrix rows)
const { data: contractsData } = await useFetch<ApiSuccess<ContractWithDetails[]>>(`/api/contracts?building_id=${id}&status=active&limit=200`)
const contractRows = computed(() =>
  (contractsData.value?.data ?? []).map(c => ({
    contractId: c.id,
    roomNumber: c.room.roomNumber,
    tenantName: c.tenant.fullName,
  })),
)

// Sync
const isSyncing = ref(false)
const syncResult = ref<string | null>(null)

async function handleSync() {
  isSyncing.value = true
  syncResult.value = null
  try {
    const added = await syncToContracts(id)
    syncResult.value = added > 0 ? `Đã thêm ${added} dịch vụ vào hợp đồng.` : 'Tất cả hợp đồng đã có đủ dịch vụ.'
    await refreshMatrix()
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
  if (existing) {
    await updateService(existing.id, { is_active: isActive })
  }
  else {
    await upsertService({ building_id: id, catalog_id: catalogId, is_active: isActive })
  }
}

async function handleUpdateAmount(catalogId: string, amount: number) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) {
    await updateService(existing.id, { default_amount: amount })
  }
  else {
    await upsertService({ building_id: id, catalog_id: catalogId, default_amount: amount })
  }
}

async function handleUpdatePricingType(catalogId: string, pricingType: PricingType) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) {
    await updateService(existing.id, { pricing_type: pricingType })
  }
  else {
    await upsertService({ building_id: id, catalog_id: catalogId, pricing_type: pricingType })
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Cài đặt dịch vụ">
      <NuxtLink :to="`/buildings/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ building?.name ?? 'Tòa nhà' }}
      </NuxtLink>
    </UiPageHeader>

    <!-- Building-level defaults -->
    <UiSection title="Cấu hình mặc định" description="Bật dịch vụ nào sẽ tự động áp dụng vào hợp đồng mới. Đơn giá là giá trị gợi ý — có thể chỉnh trực tiếp trên hợp đồng." class="mt-6">
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
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

    <!-- Sync to active contracts -->
    <UiSection title="Đồng bộ xuống hợp đồng active" description="Thêm dịch vụ còn thiếu vào các hợp đồng đang active — không ghi đè giá đã chỉnh." class="mt-6">
      <template #actions>
        <div class="flex items-center gap-3">
          <span v-if="syncResult" class="text-xs text-green-400">{{ syncResult }}</span>
          <UiButton size="sm" :loading="isSyncing" @click="handleSync">
            Đồng bộ
          </UiButton>
        </div>
      </template>
    </UiSection>

    <!-- Per-contract matrix -->
    <UiSection title="Dịch vụ theo hợp đồng" class="mt-6">
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
        <BuildingServicesMatrix
          :building-id="id"
          :catalog="services.filter(s => s.isActive).map(s => s.catalog)"
          :contracts="contractRows"
          :services="contractServices"
          :loading="loadingMatrix"
          @update="updateContractService"
        />
      </div>
    </UiSection>
  </div>
</template>

