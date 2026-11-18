<script setup lang="ts">
import { ref } from 'vue'
import type { BuildingOtherIncome } from '~/types/operations-report'
import { otherIncomeErrorMessage, useOtherIncomes } from '~/composables/operations-report/useOtherIncomes'
import { buildingOtherIncomeVoidSchema } from '~/utils/validators/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import { formatDateOnlyVi } from '~/utils/format/date-only'

const props = defineProps<{
  incomes: BuildingOtherIncome[]
  total: number
  buildingId: string
  periodYear: number
  periodMonth: number
  closed: boolean
  canWrite: boolean
  canVoid: boolean
  canUseReserve: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()
const { voidIncome } = useOtherIncomes()
const toast = useToast()
const editing = ref<BuildingOtherIncome | null>(null)
const formOpen = ref(false)
const voidTarget = ref<BuildingOtherIncome | null>(null)
const reason = ref('')
const error = ref('')
const voiding = ref(false)

function canChange(row: BuildingOtherIncome) {
  return !props.closed && !row.voidedAt && (row.allocationTarget === 'profit' || props.canUseReserve)
}

function openForm(row: BuildingOtherIncome | null) {
  editing.value = row
  formOpen.value = true
}

function saved() {
  formOpen.value = false
  toast.success(editing.value ? 'Đã cập nhật khoản thu.' : 'Đã thêm khoản thu.')
  emit('refresh')
}

function openVoid(row: BuildingOtherIncome) {
  reason.value = ''
  error.value = ''
  voidTarget.value = row
}

async function submitVoid() {
  const row = voidTarget.value
  if (!row || voiding.value || !props.canVoid || !canChange(row)) return
  const result = buildingOtherIncomeVoidSchema.safeParse({ void_reason: reason.value.trim(), expected_updated_at: row.updatedAt })
  if (!result.success) {
    error.value = result.error.issues[0]!.message
    return
  }
  voiding.value = true
  error.value = ''
  try {
    await voidIncome(row.id, result.data)
    voidTarget.value = null
    toast.success('Đã hủy khoản thu.')
    emit('refresh')
  }
  catch (err) { error.value = otherIncomeErrorMessage(err) }
  finally { voiding.value = false }
}
</script>

<template>
  <UiSection title="Khoản thu khác của tòa nhà" class="mt-6">
    <template #actions>
      <UiButton v-if="canWrite && !closed" size="sm" @click="openForm(null)">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm khoản thu
      </UiButton>
    </template>
    <div class="rounded-xl border border-ui-border bg-ui-surface md:overflow-hidden">
      <div class="flex items-baseline justify-between gap-3 border-b border-ui-border px-3.5 py-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-ui-muted">Tổng thu khác</span>
        <span class="text-sm font-semibold tabular-nums text-ui-primary">{{ formatCurrency(total) }}</span>
      </div>
      <UiEmptyState v-if="!incomes.length" size="sm" title="Chưa có khoản thu khác trong kỳ" />
      <template v-else>
        <table class="hidden w-full text-sm md:table">
          <thead>
            <tr class="border-b border-ui-border text-left text-xs text-ui-muted">
              <th class="px-4 py-2.5 font-medium">Tên khoản thu</th>
              <th class="px-4 py-2.5 font-medium">Ngày thu</th>
              <th class="px-4 py-2.5 font-medium">Phân bổ vào</th>
              <th class="px-4 py-2.5 font-medium">Người nộp</th>
              <th class="px-4 py-2.5 text-right font-medium">Số tiền</th>
              <th v-if="!closed && (canWrite || canVoid)" class="px-4 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ui-border">
            <tr v-for="row in incomes" :key="row.id">
              <td class="max-w-64 break-words px-4 py-2.5 text-ui-primary">
                {{ row.name }} <UiBadge v-if="row.voidedAt" variant="danger">Đã hủy</UiBadge>
                <p v-if="row.voidReason" class="text-xs text-ui-muted">{{ row.voidReason }}</p>
              </td>
              <td class="whitespace-nowrap px-4 py-2.5 text-ui-muted">{{ formatDateOnlyVi(row.receivedDate) }}</td>
              <td class="px-4 py-2.5 text-ui-muted">{{ row.allocationTarget === 'profit' ? 'Lợi nhuận' : 'Quỹ dự phòng' }}</td>
              <td class="max-w-40 break-words px-4 py-2.5 text-ui-muted">{{ row.payer || '—' }}</td>
              <td class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-ui-primary">{{ formatCurrency(row.amount) }}</td>
              <td v-if="!closed && (canWrite || canVoid)" class="px-4 py-2.5">
                <div v-if="canChange(row)" class="flex justify-end gap-1">
                  <UiButton v-if="canWrite" size="sm" variant="ghost" icon-only :aria-label="`Sửa ${row.name}`" @click="openForm(row)">
                    <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
                  </UiButton>
                  <UiButton v-if="canVoid" size="sm" variant="ghost" icon-only :aria-label="`Hủy ${row.name}`" @click="openVoid(row)">
                    <IconTrash class="h-4 w-4" aria-hidden="true" />
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <ul class="divide-y divide-ui-border md:hidden">
          <li v-for="row in incomes" :key="row.id" class="flex items-center justify-between gap-2 px-3.5 py-2">
            <div class="min-w-0 flex-1">
              <p class="break-words text-sm font-medium text-ui-primary">{{ row.name }}</p>
              <p class="mt-0.5 break-words text-[11px] text-ui-muted">
                {{ formatDateOnlyVi(row.receivedDate) }} · {{ row.allocationTarget === 'profit' ? 'Lợi nhuận' : 'Quỹ dự phòng' }}
                <span v-if="row.payer"> · {{ row.payer }}</span>
              </p>
              <p v-if="row.voidedAt" class="mt-0.5 break-words text-xs text-ui-muted">
                <UiBadge variant="danger">Đã hủy</UiBadge> {{ row.voidReason }}
              </p>
            </div>
            <span class="shrink-0 text-sm font-semibold tabular-nums text-ui-primary">{{ formatCurrency(row.amount) }}</span>
            <UiDropdownMenu
              v-if="canChange(row) && (canWrite || canVoid)" class="-my-2 -mr-2.5 shrink-0"
              :aria-label="`Thao tác ${row.name}`" trigger-class="min-h-11 min-w-9 !border-transparent !bg-transparent text-ui-muted"
            >
              <UiDropdownMenuItem v-if="canWrite" @click="openForm(row)">
                <template #icon><IconPencilSquare class="h-4 w-4" aria-hidden="true" /></template>
                Sửa
              </UiDropdownMenuItem>
              <UiDropdownMenuItem v-if="canVoid" variant="danger" @click="openVoid(row)">
                <template #icon><IconTrash class="h-4 w-4" aria-hidden="true" /></template>
                Hủy khoản thu
              </UiDropdownMenuItem>
            </UiDropdownMenu>
          </li>
        </ul>
      </template>
    </div>
    <OperationsOtherIncomeModal
      v-if="formOpen && !closed && canWrite && (!editing || canChange(editing))"
      :income="editing" :building-id="buildingId" :period-year="periodYear" :period-month="periodMonth"
      :can-use-reserve="canUseReserve" @close="formOpen = false" @saved="saved"
    />
    <UiModal
      v-if="voidTarget && canVoid && canChange(voidTarget)"
      open title="Hủy khoản thu" size="sm" @close="!voiding && (voidTarget = null)"
    >
      <div class="space-y-3">
        <p class="break-words text-sm text-ui-muted">
          Hủy “{{ voidTarget.name }}” ({{ formatCurrency(voidTarget.amount) }}) sẽ loại khoản này khỏi tổng thu và
          {{ voidTarget.allocationTarget === 'reserve_fund' ? 'thu hồi số tiền đã cộng vào quỹ dự phòng.' : 'giảm lợi nhuận của kỳ.' }}
        </p>
        <UiTextarea v-model="reason" label="Lý do hủy" maxlength="500" :rows="3" :disabled="voiding" required />
        <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="voiding" @click="voidTarget = null">Đóng</UiButton>
          <UiButton variant="danger" :loading="voiding" @click="submitVoid">Hủy khoản thu</UiButton>
        </div>
      </template>
    </UiModal>
  </UiSection>
</template>
