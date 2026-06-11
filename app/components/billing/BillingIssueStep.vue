<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftInvoice, BillingDraftResponse, IssueInvoicesResult } from '~/types/billing'
import type { IssueInvoicesInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  drafts: BillingDraftResponse | null
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  issue: [input: IssueInvoicesInput]
}>()

const selected = ref<Set<string>>(new Set())
const showConfirm = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const lastResult = ref<IssueInvoicesResult | null>(null)

const issuableDrafts = computed<BillingDraftInvoice[]>(() => {
  return (props.drafts?.drafts ?? []).filter(d => !d.existingInvoiceId && d.blockers.length === 0)
})

const blockedDrafts = computed<BillingDraftInvoice[]>(() => {
  return (props.drafts?.drafts ?? []).filter(d => d.blockers.length > 0)
})

const skippedDrafts = computed<BillingDraftInvoice[]>(() => {
  return (props.drafts?.drafts ?? []).filter(d => d.existingInvoiceId)
})

const allSelected = computed(() => {
  return issuableDrafts.value.length > 0 && issuableDrafts.value.every(d => selected.value.has(d.contractId))
})

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(issuableDrafts.value.map(d => d.contractId))
  }
}

function toggleOne(contractId: string) {
  const next = new Set(selected.value)
  if (next.has(contractId)) next.delete(contractId)
  else next.add(contractId)
  selected.value = next
}

const selectedCount = computed(() => selected.value.size)
const selectedTotal = computed(() => {
  return issuableDrafts.value
    .filter(d => selected.value.has(d.contractId))
    .reduce((sum, d) => sum + d.totalAmount, 0)
})

function startIssue() {
  if (selectedCount.value === 0) return
  submitError.value = null
  showConfirm.value = true
}

async function confirmIssue() {
  submitting.value = true
  submitError.value = null
  try {
    const contractIds = Array.from(selected.value)
    emit('issue', { contract_ids: contractIds })
    showConfirm.value = false
    selected.value = new Set()
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    submitError.value = e.data?.error?.message ?? 'Phát hành thất bại'
  } finally {
    submitting.value = false
  }
}

const columns: UiTableColumn<BillingDraftInvoice>[] = [
  { key: 'select', label: '', width: 'w-10' },
  { key: 'tenant', label: 'Khách thuê' },
  { key: 'room', label: 'Phòng', width: 'w-20' },
  { key: 'total', label: 'Tổng tiền', numeric: true, width: 'w-32' },
]
</script>

<template>
  <div class="space-y-4">
    <UiSection title="Phát hành hoá đơn" description="Chọn các hợp đồng đủ điều kiện và phát hành hoá đơn. Hợp đồng có blocker không nằm trong danh sách này.">
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Tính lại</UiButton>
      </template>

      <div v-if="loading" class="space-y-3">
        <UiSkeleton class="h-12 w-full" />
        <UiSkeleton class="h-12 w-full" />
      </div>

      <template v-else>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <UiMetric :label="'Có thể phát hành'" :value="issuableDrafts.length" tone="accent" />
          <UiMetric :label="'Bị blocker'" :value="blockedDrafts.length" :tone="blockedDrafts.length > 0 ? 'danger' : 'default'" />
          <UiMetric :label="'Đã phát hành (bỏ qua)'" :value="skippedDrafts.length" tone="default" />
          <UiMetric :label="'Tổng dự kiến'" :value="formatCurrency(drafts?.totals.draftTotal ?? 0)" tone="success" />
        </div>

        <UiAlert v-if="submitError" severity="danger">{{ submitError }}</UiAlert>
        <UiAlert v-if="lastResult" severity="success">
          Đã phát hành {{ lastResult.issuedCount }} hoá đơn.
        </UiAlert>

        <UiAlert v-if="blockedDrafts.length > 0" severity="warning" title="Một số hợp đồng đang bị blocker">
          {{ blockedDrafts.length }} hợp đồng chưa thể phát hành. Mở tab “Soát hoá đơn” để xem chi tiết.
        </UiAlert>

        <UiTable
          :rows="issuableDrafts"
          :columns="columns"
          row-key="contractId"
          empty-title="Không có hoá đơn nào sẵn sàng phát hành"
          empty-description="Hoặc tất cả đều đã phát hành, hoặc đang bị blocker."
        >
          <template #cell-select="{ row }">
            <UiCheckbox
              :model-value="selected.has(row.contractId)"
              @update:model-value="toggleOne(row.contractId)"
            />
          </template>
          <template #cell-tenant="{ row }">
            <div>
              <p class="text-white text-sm">{{ row.tenantName ?? '—' }}</p>
              <p class="text-xs text-muted">HĐ: {{ row.contractCode ?? row.contractId }}</p>
            </div>
          </template>
          <template #cell-room="{ row }">{{ row.roomNumber ?? '—' }}</template>
          <template #cell-total="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
        </UiTable>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div class="text-sm text-white">
            Đã chọn <strong>{{ selectedCount }}</strong> hợp đồng — tổng
            <strong class="tabular-nums">{{ formatCurrency(selectedTotal) }}</strong>
          </div>
          <div class="flex items-center gap-2">
            <UiButton
              v-if="issuableDrafts.length > 0"
              variant="secondary"
              size="sm"
              @click="toggleAll"
            >
              {{ allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
            </UiButton>
            <UiButton :disabled="selectedCount === 0" @click="startIssue">
              Phát hành {{ selectedCount > 0 ? `(${selectedCount})` : '' }}
            </UiButton>
          </div>
        </div>
      </template>
    </UiSection>

    <UiConfirmModal
      :open="showConfirm"
      title="Xác nhận phát hành"
      :message="`Phát hành ${selectedCount} hoá đơn với tổng giá trị ${formatCurrency(selectedTotal)}. Hành động này không thể hoàn tác — chỉ có thể huỷ từng hoá đơn riêng lẻ.`"
      confirm-label="Phát hành"
      :loading="submitting"
      @confirm="confirmIssue"
      @cancel="showConfirm = false"
    />
  </div>
</template>
