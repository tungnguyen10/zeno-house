<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type {
  SharedExpenseAllocationResult,
  SharedExpenseListItem,
} from '~/types/shared-expenses'
import { formatCurrency } from '~/utils/format/currency'
import { buildSharedExpenseAllocationPreview } from '~/utils/shared-expenses/allocation'

const props = defineProps<{
  open: boolean
  expense: SharedExpenseListItem | null
  buildings: Building[]
  periodYear: number
  periodMonth: number
  loading: boolean
  error: string | null
  result: SharedExpenseAllocationResult | null
}>()

const emit = defineEmits<{
  confirm: []
  close: []
}>()

const periodLabel = computed(() =>
  `${String(props.periodMonth).padStart(2, '0')}/${props.periodYear}`,
)
const preview = computed(() => props.expense
  ? buildSharedExpenseAllocationPreview(props.expense.amount, props.expense.buildingIds)
  : [],
)

function buildingName(id: string) {
  return props.buildings.find(building => building.id === id)?.name ?? id
}

function requestClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <UiModal
    :open="open"
    :title="result ? 'Phân bổ hoàn tất' : 'Xác nhận phân bổ'"
    size="lg"
    mobile-fullscreen
    @close="requestClose"
  >
    <div v-if="expense" class="space-y-4">
      <UiAlert v-if="error" severity="danger" title="Không thể phân bổ">
        {{ error }}
      </UiAlert>

      <template v-if="result">
        <UiAlert severity="success" title="Đã phân bổ">
          Đã tạo {{ result.generatedExpenses.length }} khoản chi cho kỳ {{ periodLabel }}.
        </UiAlert>
        <div class="divide-y divide-ui-border rounded-xl border border-ui-border bg-ui-surface">
          <div
            v-for="row in result.generatedExpenses"
            :key="row.expenseId"
            class="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span class="min-w-0 truncate text-ui-muted">{{ buildingName(row.buildingId) }}</span>
            <span class="shrink-0 tabular-nums font-medium text-ui-primary">
              {{ formatCurrency(row.amount) }}
            </span>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="grid gap-3 rounded-xl border border-ui-border bg-ui-surface p-4 sm:grid-cols-3">
          <div class="min-w-0 sm:col-span-2">
            <p class="text-xs text-ui-muted">Khoản chi</p>
            <p class="truncate text-sm font-semibold text-ui-primary">{{ expense.name }}</p>
          </div>
          <div>
            <p class="text-xs text-ui-muted">Kỳ phân bổ</p>
            <p class="text-sm font-semibold tabular-nums text-ui-primary">{{ periodLabel }}</p>
          </div>
          <div class="sm:col-span-3">
            <p class="text-xs text-ui-muted">Tổng tiền</p>
            <p class="text-xl font-semibold tabular-nums text-ui-primary">
              {{ formatCurrency(expense.amount) }}
            </p>
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-ui-primary">Chi phí theo tòa</h3>
            <UiBadge variant="neutral">{{ preview.length }} tòa nhà</UiBadge>
          </div>
          <div class="divide-y divide-ui-border rounded-xl border border-ui-border bg-ui-surface">
            <div
              v-for="(row, index) in preview"
              :key="row.buildingId"
              class="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate text-ui-primary">{{ buildingName(row.buildingId) }}</p>
                <p v-if="index === preview.length - 1 && expense.amount % preview.length !== 0" class="text-xs text-ui-muted">
                  Bao gồm phần dư làm tròn
                </p>
              </div>
              <span class="shrink-0 tabular-nums font-medium text-ui-primary">
                {{ formatCurrency(row.amount) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <UiButton v-if="result" type="button" @click="requestClose">Đóng</UiButton>
      <template v-else>
        <UiButton type="button" variant="secondary" :disabled="loading" @click="requestClose">
          Hủy
        </UiButton>
        <UiButton :loading="loading" :disabled="!expense" @click="emit('confirm')">
          Phân bổ {{ periodLabel }}
        </UiButton>
      </template>
    </template>
  </UiModal>
</template>
