<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import type { BuildingExpense } from '~/types/operations-report'
import { EXPENSE_CATEGORY_LABELS } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import {
  useOperationsMutations,
  useOperationsReport,
} from '~/composables/operations-report/useOperationsReport'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Báo cáo vận hành' })

const auth = useAuthStore()
const toast = useToast()

const {
  buildings,
  buildingId,
  periodYear,
  periodMonth,
  report,
  isLoading,
  errorMessage,
  forbidden,
  reload,
} = useOperationsReport()

const { createExpense, updateExpense, voidExpense, createFixedCost } = useOperationsMutations()

// --- Capability gates ---------------------------------------------------
const canWriteExpense = computed(() => auth.can('building-expenses.write'))
const canVoidExpense = computed(() => auth.can('building-expenses.delete'))
const canWriteFixedCost = computed(() => auth.can('building-fixed-costs.write'))

// --- Filter options -----------------------------------------------------
const buildingOptions = computed(() =>
  buildings.value.map(b => ({ value: b.id, label: b.name })),
)
const now = new Date()
const yearOptions = computed(() =>
  [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({
    value: y,
    label: String(y),
  })),
)
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${i + 1}`,
}))

const buildingModel = computed<string | number | null>({
  get: () => buildingId.value ?? '',
  set: (v) => { buildingId.value = typeof v === 'string' && v ? v : null },
})
const yearModel = computed<string | number | null>({
  get: () => periodYear.value,
  set: (v) => { periodYear.value = Number(v) },
})
const monthModel = computed<string | number | null>({
  get: () => periodMonth.value,
  set: (v) => { periodMonth.value = Number(v) },
})

const metrics = computed(() => report.value?.metrics ?? null)

// --- Expense modal ------------------------------------------------------
const expenseModalOpen = ref(false)
const editingExpense = ref<BuildingExpense | null>(null)
const savingExpense = ref(false)

function openCreateExpense() {
  editingExpense.value = null
  expenseModalOpen.value = true
}
function openEditExpense(expense: BuildingExpense) {
  editingExpense.value = expense
  expenseModalOpen.value = true
}

async function submitExpense(payload: Record<string, unknown>) {
  savingExpense.value = true
  try {
    if (editingExpense.value) {
      await updateExpense(editingExpense.value.id, payload)
      toast.success('Đã cập nhật chi phí.')
    }
    else {
      await createExpense(payload)
      toast.success('Đã thêm chi phí.')
    }
    expenseModalOpen.value = false
    reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không lưu được chi phí.'))
  }
  finally {
    savingExpense.value = false
  }
}

// --- Void modal ---------------------------------------------------------
const voidModalOpen = ref(false)
const voidTarget = ref<BuildingExpense | null>(null)
const voidReason = ref('')
const voidError = ref<string | null>(null)
const voiding = ref(false)

function openVoid(expense: BuildingExpense) {
  voidTarget.value = expense
  voidReason.value = ''
  voidError.value = null
  voidModalOpen.value = true
}

async function submitVoid() {
  voidError.value = null
  if (!voidReason.value.trim()) {
    voidError.value = 'Lý do hủy là bắt buộc.'
    return
  }
  if (!voidTarget.value) return
  voiding.value = true
  try {
    await voidExpense(voidTarget.value.id, voidReason.value.trim())
    toast.success('Đã hủy chi phí.')
    voidModalOpen.value = false
    reload()
  }
  catch (err) {
    voidError.value = resolveError(err, 'Không hủy được chi phí.')
  }
  finally {
    voiding.value = false
  }
}

// --- Fixed cost modal ---------------------------------------------------
const fixedCostModalOpen = ref(false)
const savingFixedCost = ref(false)

async function submitFixedCost(payload: Record<string, unknown>) {
  savingFixedCost.value = true
  try {
    await createFixedCost(payload)
    toast.success('Đã thêm chi phí cố định.')
    fixedCostModalOpen.value = false
    reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không lưu được chi phí cố định.'))
  }
  finally {
    savingFixedCost.value = false
  }
}

function resolveError(err: unknown, fallback: string): string {
  const body = (err as { data?: { error?: { message?: string } } })?.data
  return body?.error?.message ?? fallback
}

function expenseLabel(category: BuildingExpense['category']) {
  return EXPENSE_CATEGORY_LABELS[category]
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Báo cáo vận hành"
      description="Doanh thu, chi phí và lợi nhuận theo tòa nhà từng tháng."
    />

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 mb-6">
      <UiSelect
        v-model="buildingModel"
        label="Tòa nhà"
        :options="buildingOptions"
        placeholder="Chọn tòa nhà"
        class="min-w-[200px]"
      />
      <UiSelect v-model="yearModel" label="Năm" :options="yearOptions" class="w-32" />
      <UiSelect v-model="monthModel" label="Tháng" :options="monthOptions" class="w-36" />
    </div>

    <UiAlert v-if="forbidden" severity="danger" class="mb-6">
      Bạn không có quyền xem báo cáo vận hành của tòa nhà này.
    </UiAlert>
    <UiAlert v-else-if="errorMessage" severity="danger" class="mb-6">
      {{ errorMessage }}
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiSkeleton v-for="n in 4" :key="n" class="h-28 rounded-2xl" />
    </div>

    <template v-else-if="report && metrics">
      <!-- KPI cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AppStatCard
          title="Doanh thu phát hành"
          :value="formatCurrency(metrics.issuedRevenue)"
        />
        <AppStatCard title="Đã thu" :value="formatCurrency(metrics.collectedCash)" />
        <AppStatCard title="Công nợ" :value="formatCurrency(metrics.debt)" />
        <AppStatCard title="Tổng chi phí" :value="formatCurrency(metrics.totalExpense)" />
        <AppStatCard
          title="Lợi nhuận (theo phát hành)"
          :value="formatCurrency(metrics.profitByRevenue)"
          description="Doanh thu phát hành − tổng chi phí"
        />
        <AppStatCard
          title="Lợi nhuận (theo tiền thu)"
          :value="formatCurrency(metrics.profitByCash)"
          description="Tiền đã thu − tổng chi phí"
        />
        <AppStatCard
          title="Chi phí cố định"
          :value="formatCurrency(metrics.fixedCostTotal)"
        />
        <AppStatCard
          title="Chi phí phát sinh"
          :value="formatCurrency(metrics.monthlyExpenseTotal)"
        />
      </div>

      <!-- Utility margins -->
      <div class="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-dark-border bg-dark-surface p-5">
          <h3 class="text-sm font-semibold text-white">Điện — chênh lệch</h3>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Thu từ khách</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.electricity.collected) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Đầu vào</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.electricity.input) }}</dd>
            </div>
            <div class="flex justify-between border-t border-dark-border pt-1.5 font-semibold">
              <dt class="text-muted">Chênh lệch</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.electricity.margin) }}</dd>
            </div>
          </dl>
        </div>
        <div class="rounded-2xl border border-dark-border bg-dark-surface p-5">
          <h3 class="text-sm font-semibold text-white">Nước — chênh lệch</h3>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Thu từ khách</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.water.collected) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Đầu vào</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.water.input) }}</dd>
            </div>
            <div class="flex justify-between border-t border-dark-border pt-1.5 font-semibold">
              <dt class="text-muted">Chênh lệch</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.water.margin) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Revenue breakdown -->
      <UiSection title="Doanh thu theo loại" class="mt-8">
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="row in report.revenueByType"
            :key="row.key"
            class="flex items-center justify-between px-5 py-3 text-sm"
          >
            <span class="text-muted">{{ row.label }}</span>
            <span class="tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
          </div>
          <div v-if="report.revenueByType.length === 0" class="px-5 py-6">
            <UiEmptyState title="Chưa có doanh thu" description="Kỳ này chưa phát hành hóa đơn." />
          </div>
        </div>
      </UiSection>

      <!-- Fixed costs -->
      <UiSection title="Chi phí cố định" class="mt-8">
        <template #actions>
          <UiButton
            v-if="canWriteFixedCost"
            size="sm"
            @click="fixedCostModalOpen = true"
          >
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Thêm
          </UiButton>
        </template>
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="fc in report.fixedCosts"
            :key="fc.id"
            class="flex items-center justify-between px-5 py-3 text-sm"
          >
            <div>
              <span class="text-white">Tiền thuê nhà</span>
              <span class="ml-2 text-xs text-muted">
                từ {{ fc.effectiveFromPeriodMonth }}/{{ fc.effectiveFromPeriodYear }}
                <template v-if="fc.effectiveToPeriodYear">
                  đến {{ fc.effectiveToPeriodMonth }}/{{ fc.effectiveToPeriodYear }}
                </template>
              </span>
            </div>
            <span class="tabular-nums text-white">{{ formatCurrency(fc.amount) }}</span>
          </div>
          <div v-if="report.fixedCosts.length === 0" class="px-5 py-6">
            <UiEmptyState
              title="Chưa có chi phí cố định"
              description="Thêm tiền thuê nhà để tính lợi nhuận chính xác."
            />
          </div>
        </div>
      </UiSection>

      <!-- Expenses -->
      <UiSection title="Chi phí phát sinh trong tháng" class="mt-8">
        <template #actions>
          <UiButton v-if="canWriteExpense" size="sm" @click="openCreateExpense">
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Thêm chi phí
          </UiButton>
        </template>
        <div class="overflow-hidden rounded-2xl border border-dark-border bg-dark-surface">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-dark-border text-left text-xs text-muted">
                <th class="px-5 py-3 font-medium">Loại</th>
                <th class="px-5 py-3 font-medium">Ngày</th>
                <th class="px-5 py-3 font-medium">Nhận</th>
                <th class="px-5 py-3 text-right font-medium">Số tiền</th>
                <th class="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-border">
              <tr
                v-for="e in report.expenses"
                :key="e.id"
                :class="{ 'opacity-50': e.voidedAt }"
              >
                <td class="px-5 py-3">
                  <span class="text-white">{{ expenseLabel(e.category) }}</span>
                  <UiBadge v-if="e.voidedAt" class="ml-2" variant="danger">Đã hủy</UiBadge>
                  <p v-if="e.note" class="text-xs text-muted mt-0.5">{{ e.note }}</p>
                </td>
                <td class="px-5 py-3 text-muted">{{ e.expenseDate ?? '—' }}</td>
                <td class="px-5 py-3 text-muted">{{ e.payee ?? '—' }}</td>
                <td class="px-5 py-3 text-right tabular-nums text-white">
                  {{ formatCurrency(e.amount) }}
                </td>
                <td class="px-5 py-3">
                  <div class="flex justify-end gap-1">
                    <UiButton
                      v-if="canWriteExpense && !e.voidedAt"
                      size="sm"
                      variant="ghost"
                      icon-only
                      aria-label="Sửa"
                      @click="openEditExpense(e)"
                    >
                      <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
                    </UiButton>
                    <UiButton
                      v-if="canVoidExpense && !e.voidedAt"
                      size="sm"
                      variant="ghost"
                      icon-only
                      aria-label="Hủy"
                      @click="openVoid(e)"
                    >
                      <IconTrash class="h-4 w-4" aria-hidden="true" />
                    </UiButton>
                  </div>
                </td>
              </tr>
              <tr v-if="report.expenses.length === 0">
                <td colspan="5" class="px-5 py-8">
                  <UiEmptyState
                    title="Chưa có chi phí"
                    description="Ghi nhận chi phí phát sinh để theo dõi lợi nhuận thực tế."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiSection>
    </template>

    <!-- Modals -->
    <OperationsExpenseModal
      v-if="buildingId"
      :open="expenseModalOpen"
      :expense="editingExpense"
      :building-id="buildingId"
      :period-year="periodYear"
      :period-month="periodMonth"
      :submitting="savingExpense"
      @close="expenseModalOpen = false"
      @submit="submitExpense"
    />

    <OperationsFixedCostModal
      v-if="buildingId"
      :open="fixedCostModalOpen"
      :building-id="buildingId"
      :period-year="periodYear"
      :period-month="periodMonth"
      :submitting="savingFixedCost"
      @close="fixedCostModalOpen = false"
      @submit="submitFixedCost"
    />

    <UiModal :open="voidModalOpen" title="Hủy chi phí" size="sm" @close="voidModalOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Chi phí sẽ được đánh dấu đã hủy và không tính vào tổng chi phí. Vui lòng nhập lý do.
        </p>
        <UiTextarea v-model="voidReason" label="Lý do hủy" :rows="3" required />
        <UiAlert v-if="voidError" severity="danger">{{ voidError }}</UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="voiding" @click="voidModalOpen = false">
            Đóng
          </UiButton>
          <UiButton variant="danger" :loading="voiding" @click="submitVoid">Hủy chi phí</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
