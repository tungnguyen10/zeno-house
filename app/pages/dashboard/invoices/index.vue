<script setup lang="ts">

import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { InvoiceListItem } from '~/utils/validators/invoices'

definePageMeta({ title: 'Hoá đơn' })

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Hoá đơn' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

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
  resetFilters,
} = useInvoiceList()

const selectedInvoice = ref<InvoiceListItem | null>(null)
const drawerOpen = ref(false)
const toast = useToast()
const { openPrint } = useInvoicePrinting()
const {
  sending: sendingEmail,
  error: invoiceEmailError,
  enqueue: enqueueInvoiceEmail,
} = useInvoiceEmailDelivery()
const invoiceEmailEnabled = useRuntimeConfig().public.invoiceEmailEnabled === true
const emailConfirmOpen = ref(false)
const bulkEmailSummary = ref<string | null>(null)
const {
  selectedIds,
  selectedInvoices,
  selectableInvoices,
  allSelected,
  someSelected,
  toggle: togglePrintSelection,
  toggleAll: toggleSelectAll,
  clearSelection,
} = useInvoicePagePrintSelection(invoices)

const { data: buildingResponse, status: buildingsStatus } = useLazyFetch<
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

async function sendSelectedInvoices() {
  if (selectedInvoices.value.length === 0 || selectedInvoices.value.length > 100) return
  try {
    const result = await enqueueInvoiceEmail(selectedInvoices.value.map(invoice => invoice.id))
    const counts = result.results.reduce((summary, item) => {
      summary[item.status] += 1
      return summary
    }, { queued: 0, already_queued: 0, skipped: 0, failed: 0 })
    bulkEmailSummary.value = [
      `Đã xếp hàng ${counts.queued}`,
      counts.already_queued ? `đã có trong hàng ${counts.already_queued}` : null,
      counts.skipped ? `bỏ qua ${counts.skipped}` : null,
      counts.failed ? `không thành công ${counts.failed}` : null,
    ].filter(Boolean).join(' · ')
    emailConfirmOpen.value = false
    clearSelection()
    toast.success('Đã xử lý danh sách gửi email.')
  }
  catch {
    // The modal keeps context and shows the standardized error.
  }
}
</script>

<template>
  <AppPullToRefresh :on-refresh="refresh">
  <div class="space-y-5">
    <UiPageHeader
      title="Hoá đơn"
      description="Tra cứu hoá đơn theo tòa nhà, kỳ, trạng thái và khách thuê."
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

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

      <UiAlert v-if="bulkEmailSummary" severity="success" dismissible @dismiss="bulkEmailSummary = null">
        {{ bulkEmailSummary }}
      </UiAlert>

      <UiEmptyState
        v-if="forbiddenBuildingError"
        title="Không có quyền truy cập building này"
        description="Đổi building hoặc mở rộng bộ lọc."
      />

      <div v-else class="relative">
        <div
          v-if="isLoading && invoices.length > 0"
          class="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-ui-border"
          aria-hidden="true"
        >
          <div class="h-full w-1/3 animate-pulse rounded-full bg-ui-accent" />
        </div>

        <UiSelectAllBar
          v-if="selectableInvoices.length > 0"
          :model-value="allSelected"
          :indeterminate="someSelected"
          :page-count="selectableInvoices.length"
          :total-selected="selectedInvoices.length"
          aria-label="Chọn tất cả hoá đơn trên trang"
          @update:model-value="toggleSelectAll"
        />

        <InvoiceListTable
          :rows="invoices"
          :loading="isLoading && invoices.length === 0"
          :selected-ids="selectedIds"
          @open="openInvoice"
          @toggle-select="togglePrintSelection"
        />
      </div>

      <UiPagination
        :page="meta.page"
        :total-pages="meta.total_pages"
        :total-label="totalLabel"
        @update:page="page = $event"
      />
    </template>

    <InvoicePreviewDrawer
      v-model="drawerOpen"
      :invoice="selectedInvoice"
      @print="openPrint([$event])"
    />

    <UiBulkActionsBar
      aria-label="Thao tác hàng loạt hoá đơn"
      :count="selectedInvoices.length"
      @clear="clearSelection"
    >
      <UiButton class="whitespace-nowrap" variant="primary" size="sm" @click="printSelectedInvoices">In phiếu</UiButton>
      <UiButton
        v-if="invoiceEmailEnabled"
        class="whitespace-nowrap"
        variant="secondary"
        size="sm"
        :disabled="selectedInvoices.length > 100"
        @click="emailConfirmOpen = true"
      >
        Gửi email ({{ selectedInvoices.length }})
      </UiButton>
    </UiBulkActionsBar>

    <UiModal
      :open="emailConfirmOpen"
      title="Gửi các hoá đơn đã chọn?"
      size="sm"
      @close="emailConfirmOpen = false"
    >
      <div class="space-y-3">
        <p class="text-sm leading-6 text-ui-muted">
          {{ selectedInvoices.length }} hoá đơn trên trang hiện tại sẽ được xếp hàng gửi đến email liên hệ chính của từng khách thuê.
        </p>
        <UiAlert v-if="selectedInvoices.length > 100" severity="warning">
          Mỗi lần chỉ gửi tối đa 100 hoá đơn. Hãy giảm số lượng đã chọn.
        </UiAlert>
        <UiAlert v-if="invoiceEmailError" severity="danger">{{ invoiceEmailError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="sendingEmail" @click="emailConfirmOpen = false">Huỷ</UiButton>
        <UiButton
          :loading="sendingEmail"
          :disabled="selectedInvoices.length === 0 || selectedInvoices.length > 100"
          @click="sendSelectedInvoices"
        >
          Gửi email ({{ selectedInvoices.length }})
        </UiButton>
      </template>
    </UiModal>
  </div>
  </AppPullToRefresh>
</template>
