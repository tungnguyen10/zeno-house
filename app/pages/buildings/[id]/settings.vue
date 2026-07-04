<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { ContractWithDetails } from '~/types/contracts'
import type { AssignmentManager } from '~/types/assignments'
import type { BuildingFixedCost } from '~/types/operations-report'
import { FIXED_COST_CATEGORY_LABELS } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string
const authStore = useAuthStore()

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

const { data: managersData } = await useFetch<ApiSuccess<AssignmentManager[]>>(
  `/api/assignments/by-building/${id}`,
  { immediate: authStore.canManageUsers },
)
const assignedManagers = computed(() => managersData.value?.data ?? [])

const activeServiceCount = computed(() => services.value.filter(s => s.isActive).length)
const canManageFixedCosts = computed(() => authStore.can('building-fixed-costs.write'))
const now = new Date()
const fixedCostPeriodYear = ref(now.getFullYear())
const fixedCostPeriodMonth = ref(now.getMonth() + 1)
const fixedCostModalOpen = ref(false)
const savingFixedCost = ref(false)
const endFixedCostModalOpen = ref(false)
const endingFixedCost = ref(false)
const endFixedCostTarget = ref<BuildingFixedCost | null>(null)
const endPeriodYear = ref(now.getFullYear())
const endPeriodMonth = ref(now.getMonth() + 1)
const fixedCostError = ref<string | null>(null)
const { createFixedCost } = useOperationsMutations()
const { data: fixedCostsData, refresh: refreshFixedCosts } = await useFetch<ApiSuccess<BuildingFixedCost[]>>(
  '/api/building-fixed-costs',
  {
    query: { building_id: id },
    immediate: canManageFixedCosts.value,
    watch: false,
  },
)
const fixedCosts = computed(() => fixedCostsData.value?.data ?? [])

async function submitFixedCost(payload: Record<string, unknown>) {
  savingFixedCost.value = true
  fixedCostError.value = null
  try {
    await createFixedCost(payload)
    fixedCostModalOpen.value = false
    await refreshFixedCosts()
  }
  catch (err) {
    fixedCostError.value = resolveApiError(err, 'Không lưu được chi phí vận hành.')
  }
  finally {
    savingFixedCost.value = false
  }
}

function openEndFixedCost(cost: BuildingFixedCost) {
  endFixedCostTarget.value = cost
  endPeriodYear.value = fixedCostPeriodYear.value
  endPeriodMonth.value = fixedCostPeriodMonth.value
  fixedCostError.value = null
  endFixedCostModalOpen.value = true
}

async function submitEndFixedCost() {
  if (!endFixedCostTarget.value) return
  endingFixedCost.value = true
  fixedCostError.value = null
  try {
    await $fetch(`/api/building-fixed-costs/${endFixedCostTarget.value.id}`, {
      method: 'PATCH',
      body: {
        effective_to_period_year: Number(endPeriodYear.value),
        effective_to_period_month: Number(endPeriodMonth.value),
      },
    })
    endFixedCostModalOpen.value = false
    await refreshFixedCosts()
  }
  catch (err) {
    fixedCostError.value = resolveApiError(err, 'Không kết thúc được chi phí vận hành.')
  }
  finally {
    endingFixedCost.value = false
  }
}

function resolveApiError(err: unknown, fallback: string): string {
  const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message
  return msg ?? fallback
}

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
          <UiInput
            v-model="codeInput"
            label="Code"
            :disabled="isCodeLocked"
            :title="isCodeLocked ? 'Không thể đổi vì tòa nhà đã có phòng' : undefined"
            placeholder="vd: zhpn"
            input-class="font-mono"
            class="flex-1 min-w-0"
          />
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
              <IconLock class="h-3.5 w-3.5" aria-hidden="true" />
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

    <UiSection
      v-if="authStore.canManageUsers"
      title="Managers"
      description="Những manager đang được phân quyền vào tòa nhà này."
    >
      <template #actions>
        <NuxtLink to="/settings/managers" class="text-sm text-cyan hover:text-cyan/80 transition-colors">
          Quản lý phân quyền
        </NuxtLink>
      </template>
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <div v-if="assignedManagers.length === 0" class="text-sm text-muted">
          Chưa có manager nào được gán.
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="manager in assignedManagers"
            :key="manager.id"
            class="rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white"
          >
            {{ manager.name ?? manager.email ?? manager.id }}
          </span>
        </div>
      </div>
    </UiSection>

    <UiSection
      v-if="canManageFixedCosts"
      title="Chi phí vận hành"
      description="Quản lý chi phí cố định theo tháng cho báo cáo vận hành."
    >
      <template #actions>
        <UiButton size="sm" @click="fixedCostModalOpen = true">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm chi phí
        </UiButton>
      </template>
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <UiAlert v-if="fixedCostError" severity="danger" class="mb-4">
          {{ fixedCostError }}
        </UiAlert>
        <div v-if="fixedCosts.length === 0" class="text-sm text-muted">
          Chưa có chi phí vận hành cố định.
        </div>
        <div v-else class="divide-y divide-dark-border">
          <div
            v-for="cost in fixedCosts"
            :key="cost.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">
                {{ FIXED_COST_CATEGORY_LABELS[cost.category] ?? cost.category }}
              </div>
              <div class="mt-1 text-xs text-muted">
                Từ {{ cost.effectiveFromPeriodMonth }}/{{ cost.effectiveFromPeriodYear }}
                <template v-if="cost.effectiveToPeriodYear">
                  đến {{ cost.effectiveToPeriodMonth }}/{{ cost.effectiveToPeriodYear }}
                </template>
                <template v-else>
                  · đang áp dụng
                </template>
              </div>
              <p v-if="cost.note" class="mt-1 text-xs text-muted">{{ cost.note }}</p>
            </div>
            <div class="flex items-center justify-between gap-3 sm:justify-end">
              <span class="tabular-nums text-white">{{ formatCurrency(cost.amount) }}</span>
              <UiButton
                v-if="!cost.effectiveToPeriodYear"
                size="sm"
                variant="secondary"
                @click="openEndFixedCost(cost)"
              >
                Kết thúc
              </UiButton>
            </div>
          </div>
        </div>
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

    <OperationsFixedCostModal
      :open="fixedCostModalOpen"
      :building-id="id"
      :period-year="fixedCostPeriodYear"
      :period-month="fixedCostPeriodMonth"
      :submitting="savingFixedCost"
      @close="fixedCostModalOpen = false"
      @submit="submitFixedCost"
    />

    <UiModal
      :open="endFixedCostModalOpen"
      title="Kết thúc chi phí vận hành"
      size="sm"
      @close="endFixedCostModalOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Chọn kỳ cuối cùng còn áp dụng chi phí này.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UiInput v-model="endPeriodYear" label="Năm kết thúc" type="number" />
          <UiInput v-model="endPeriodMonth" label="Tháng kết thúc" type="number" />
        </div>
        <UiAlert v-if="fixedCostError" severity="danger">
          {{ fixedCostError }}
        </UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="endingFixedCost" @click="endFixedCostModalOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="endingFixedCost" @click="submitEndFixedCost">
            Lưu
          </UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
