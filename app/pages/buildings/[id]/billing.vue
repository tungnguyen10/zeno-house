<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'

definePageMeta({ title: 'Billing Workspace' })

const route = useRoute()
const buildingId = computed(() => String(route.params.id))
const year = computed(() => Number(route.query.year ?? new Date().getFullYear()))
const month = computed(() => Number(route.query.month ?? new Date().getMonth() + 1))

// Building info
const { data: buildingData } = useFetch<ApiSuccess<Building>>(
  () => `/api/buildings/${buildingId.value}`,
)
const building = computed(() => buildingData.value?.data ?? null)

// Workspace + period
const { workspaceData, isLoading: isWorkspaceLoading, refresh: refreshWorkspace } = useBillingWorkspace(buildingId, year, month)
const period = computed(() => workspaceData.value?.period ?? null)
const activeRun = computed(() => workspaceData.value?.run ?? null)
const buildingRates = computed(() => workspaceData.value?.buildingRates ?? { electricityRate: 0, waterRate: 0 })

// Billing items (after generate)
const billingRunId = computed(() => activeRun.value?.id ?? null)
const { items, summary, refresh: refreshItems } = useBillingItems(billingRunId)

// Generate
const isGenerating = ref(false)
const generateError = ref<string | null>(null)
const showRegenerateModal = ref(false)
const regeneratePaidCount = ref(0)

async function generate() {
  if (activeRun.value) {
    const paidCount = items.value.filter(i => i.paymentStatus === 'paid').length
    if (paidCount > 0) {
      regeneratePaidCount.value = paidCount
      showRegenerateModal.value = true
      return
    }
  }
  await doGenerate()
}

async function doGenerate() {
  isGenerating.value = true
  generateError.value = null
  try {
    await $fetch('/api/billing-runs/generate', {
      method: 'POST',
      body: { building_id: buildingId.value, year: year.value, month: month.value },
    })
    await refreshWorkspace()
    await nextTick()
    await refreshItems()
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string; data?: { error?: { message?: string } } } }
    generateError.value = err?.data?.data?.error?.message ?? err?.data?.message ?? 'Lỗi tạo hóa đơn'
  }
  finally {
    isGenerating.value = false
  }
}

// Payment toggle
const isPaymentSaving = ref(false)

async function handleTogglePaid(itemId: string, currentStatus: string) {
  isPaymentSaving.value = true
  try {
    await $fetch('/api/billing-items/bulk-payment-status', {
      method: 'POST',
      body: {
        ids: [itemId],
        status: currentStatus === 'paid' ? 'unpaid' : 'paid',
      },
    })
    await refreshItems()
  }
  finally {
    isPaymentSaving.value = false
  }
}

// Finalize/unlock
const { isSaving: isPeriodSaving, finalize, unlock, syncPeriod } = useBillingPeriod(buildingId, year, month)
watch(period, (p) => { if (p) syncPeriod(p) }, { immediate: true })

async function handleFinalize() {
  await finalize()
  await refreshWorkspace()
}

async function handleUnlock() {
  await unlock()
  await refreshWorkspace()
}

// Save readings
async function onReadingUpdate(roomId: string, meterType: 'electricity' | 'water', value: number | null) {
  if (value == null) return
  try {
    await $fetch('/api/meter-readings/bulk', {
      method: 'POST',
      body: {
        building_id: buildingId.value,
        period_year: year.value,
        period_month: month.value,
        readings: [{
          room_id: roomId,
          meter_type: meterType,
          new_reading: value,
        }],
      },
    })
  }
  catch {
    // Silent fail on autosave — user will see stale data on refresh
  }
}

// Adjust old reading
async function onOldReadingUpdate(roomId: string, meterType: 'electricity' | 'water', value: number | null, reason: string) {
  if (value == null) return
  try {
    await $fetch('/api/meter-readings/bulk', {
      method: 'POST',
      body: {
        building_id: buildingId.value,
        period_year: year.value,
        period_month: month.value,
        readings: [{
          room_id: roomId,
          meter_type: meterType,
          old_reading: value,
          is_adjusted: true,
          adjustment_reason: reason,
        }],
      },
    })
    await refreshWorkspace()
  }
  catch {
    // Silent fail
  }
}

const meterReadings = computed(() => workspaceData.value?.meterReadings ?? [])
const activeContracts = computed(() => workspaceData.value?.activeContracts ?? [])
const monthName = computed(() => `Tháng ${month.value}/${year.value}`)
</script>

<template>
  <div class="space-y-6">
    <!-- Context bar -->
    <div class="flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <NuxtLink :to="`/buildings/${buildingId}`" class="text-muted hover:text-white text-sm transition-colors">
            {{ building?.name ?? '...' }}
          </NuxtLink>
          <span class="text-muted">/</span>
          <h1 class="text-xl font-semibold text-white">Tính tiền {{ monthName }}</h1>
          <BillingStatusBadge v-if="period" :status="period.status" />
        </div>
        <p v-if="activeRun" class="text-xs text-muted mt-0.5">
          {{ items.length }} phòng · Tổng: {{ new Intl.NumberFormat('vi-VN').format(summary.totalReceivable) }}đ
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="period?.status === 'draft'"
          class="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          :disabled="isGenerating"
          @click="generate"
        >
          {{ activeRun ? 'Tạo lại hóa đơn' : 'Tạo hóa đơn' }}
        </button>
        <button
          v-if="period?.status === 'draft' && activeRun"
          class="px-3 py-1.5 bg-dark-surface border border-dark-border text-muted text-sm font-medium rounded-md hover:text-white transition-colors"
          :disabled="isPeriodSaving"
          @click="handleFinalize"
        >
          Khóa kỳ
        </button>
        <button
          v-if="period?.status === 'finalized'"
          class="px-3 py-1.5 bg-dark-surface border border-dark-border text-warning text-sm font-medium rounded-md hover:text-white transition-colors"
          :disabled="isPeriodSaving"
          @click="handleUnlock"
        >
          Mở khóa
        </button>
      </div>
    </div>

    <div v-if="generateError" class="p-3 rounded-lg bg-error-bg border border-error-vivid/30 text-error-vivid text-sm">
      {{ generateError }}
    </div>

    <!-- Consolidated table -->
    <div v-if="isWorkspaceLoading" class="text-muted text-sm">Đang tải...</div>
    <BillingConsolidatedTable
      v-else
      :contracts="activeContracts"
      :meter-readings="meterReadings"
      :billing-items="items"
      :electricity-rate="buildingRates.electricityRate"
      :water-rate="buildingRates.waterRate"
      :disabled="period?.status === 'finalized'"
      @update:reading="onReadingUpdate"
      @toggle-paid="handleTogglePaid"
    />

    <!-- Adjustment section -->
    <BillingAdjustmentSection
      v-if="!isWorkspaceLoading"
      :contracts="activeContracts"
      :meter-readings="meterReadings"
      :disabled="period?.status === 'finalized'"
      @update:old-reading="onOldReadingUpdate"
    />
  </div>

  <BillingRegenerateModal
    :is-open="showRegenerateModal"
    :paid-count="regeneratePaidCount"
    @close="showRegenerateModal = false"
    @confirm-mark-unpaid="showRegenerateModal = false; doGenerate()"
  />
</template>
