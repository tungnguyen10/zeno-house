<script setup lang="ts">

import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { InvoiceListItem } from '~/utils/validators/invoices'

definePageMeta({ title: 'Hoá đơn' })

const {
  buildingId,
  periodYear,
  periodMonth,
  allMonths,
  status,
  tenantSearchInput,
  page,
  invoices,
  meta,
  isLoading,
  isInitialLoading,
  errorMessage,
  errorCode,
  hasActiveFilters,
  refresh,
  nextPage,
  previousPage,
  resetFilters,
} = useInvoiceList()

const selectedInvoice = ref<InvoiceListItem | null>(null)
const drawerOpen = ref(false)
const toast = useToast()
const { openPrint } = useInvoicePrinting()
const {
  selectedIds,
  selectedInvoices,
  toggle: togglePrintSelection,
  clearSelection,
} = useInvoicePagePrintSelection(invoices)

const { data: buildingResponse, status: buildingsStatus } = await useFetch<
  ApiSuccess<Building[]> & { meta: { total: number } }
>('/api/buildings', {
  query: { page: 1, limit: 100, sort: 'name', order: 'asc' },
})

const buildings = computed(() => buildingResponse.value?.data ?? [])
const buildingsLoading = computed(() => buildingsStatus.value === 'pending')
const totalLabel = computed(() => `${meta.value.total} kết quả`)
const forbiddenBuildingError = computed(() => errorCode.value === 'FORBIDDEN')

watch(errorMessage, (message) => {
  if (forbiddenBuildingError.value && message) {
    toast.info(message)
  }
})

function openInvoice(invoice: InvoiceListItem) {
  selectedInvoice.value = invoice
  drawerOpen.value = true
}

function printSelectedInvoices() {
  openPrint(selectedInvoices.value.map(invoice => invoice.id))
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      title="Hoá đơn"
      description="Tra cứu hoá đơn theo tòa nhà, kỳ, trạng thái và khách thuê."
    />

    <template v-if="isInitialLoading">
      <UiSkeleton class="h-20 w-full rounded-lg" />
      <InvoiceListTable :rows="[]" loading />
    </template>

    <template v-else>
      <InvoiceFilterBar
        v-model:building-id="buildingId"
        v-model:period-year="periodYear"
        v-model:period-month="periodMonth"
        v-model:all-months="allMonths"
        v-model:statuses="status"
        v-model:tenant-search="tenantSearchInput"
        :buildings="buildings"
        :buildings-loading="buildingsLoading"
        :has-active-filters="hasActiveFilters"
        @reset="resetFilters"
      />

      <UiAlert v-if="errorMessage && !forbiddenBuildingError" severity="danger">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{{ errorMessage }}</span>
          <UiButton variant="secondary" size="sm" @click="refresh()">Tải lại</UiButton>
        </div>
      </UiAlert>

      <UiEmptyState
        v-if="forbiddenBuildingError"
        title="Không có quyền truy cập building này"
        description="Đổi building hoặc mở rộng bộ lọc."
      />

      <div v-else class="relative">
        <div
          v-if="isLoading && invoices.length > 0"
          class="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-dark-border"
          aria-hidden="true"
        >
          <div class="h-full w-1/3 animate-pulse rounded-full bg-cyan" />
        </div>

        <InvoiceListTable
          :rows="invoices"
          :loading="isLoading && invoices.length === 0"
          :selected-ids="selectedIds"
          @open="openInvoice"
          @toggle-select="togglePrintSelection"
        />
      </div>

      <div class="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Trang {{ meta.page }}/{{ meta.total_pages }} · {{ totalLabel }}
        </span>
        <div class="flex items-center gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="page <= 1"
            @click="previousPage"
          >
            Trước
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="page >= meta.total_pages"
            @click="nextPage"
          >
            Sau
          </UiButton>
        </div>
      </div>
    </template>

    <InvoicePreviewDrawer
      v-model="drawerOpen"
      :invoice="selectedInvoice"
      @print="openPrint([$event])"
    />

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="selectedInvoices.length > 0"
        class="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-max -translate-x-1/2 rounded-xl border border-dark-border bg-dark-card px-4 py-2 shadow-lg shadow-black/40 backdrop-blur sm:w-auto sm:rounded-full"
      >
        <div class="grid grid-cols-2 items-center gap-2 sm:flex sm:gap-3">
          <span class="col-span-2 text-center text-sm text-white sm:col-auto sm:text-left">
            Đã chọn <span class="font-semibold">{{ selectedInvoices.length }}</span> hóa đơn
          </span>
          <UiButton class="whitespace-nowrap" variant="ghost" size="sm" @click="clearSelection">Bỏ chọn</UiButton>
          <UiButton class="whitespace-nowrap" variant="primary" size="sm" @click="printSelectedInvoices">In phiếu</UiButton>
        </div>
      </div>
    </Transition>
  </div>
</template>
