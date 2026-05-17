<script setup lang="ts">
import clsx from 'clsx'
import { formatCurrency } from '~/utils/format/currency'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'

const props = defineProps<{
  currentEndDate: string
  currentMonthlyRent: number
  loading?: boolean
  apiError?: string | null
}>()

const emit = defineEmits<{
  'submit': [value: ContractRenewInput]
  'cancel': []
}>()

const form = reactive({
  mode: 'extend' as 'extend' | 'new_contract',
  new_end_date: '',
  new_monthly_rent: String(props.currentMonthlyRent),
  reason: '',
})

const fieldErrors = ref<Record<string, string>>({})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.new_end_date) {
    fieldErrors.value.new_end_date = 'Bắt buộc'
  } else if (form.new_end_date <= props.currentEndDate) {
    fieldErrors.value.new_end_date = 'Phải sau ngày kết thúc hiện tại'
  }
  const rent = Number(form.new_monthly_rent)
  if (form.mode === 'new_contract' && (isNaN(rent) || rent < 0)) {
    fieldErrors.value.new_monthly_rent = 'Giá thuê không hợp lệ'
  }
  return Object.keys(fieldErrors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const rent = Number(form.new_monthly_rent)
  const input: ContractRenewInput = form.mode === 'extend'
    ? {
        mode: 'extend',
        new_end_date: form.new_end_date,
        new_monthly_rent: !isNaN(rent) && rent > 0 ? rent : undefined,
        reason: form.reason || null,
      }
    : {
        mode: 'new_contract',
        new_end_date: form.new_end_date,
        new_monthly_rent: rent,
        reason: form.reason || null,
      }
  emit('submit', input)
}

const inputClass = 'block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
const labelClass = 'block text-sm font-medium text-zinc-300 mb-1'
const errorClass = 'mt-1 text-xs text-red-400'
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <!-- API error -->
    <div v-if="props.apiError" class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {{ props.apiError }}
    </div>

    <!-- Current term info -->
    <div class="rounded-md bg-zinc-800/60 border border-zinc-700 px-4 py-3 text-sm text-zinc-400">
      Ngày kết thúc hiện tại: <span class="text-white font-medium">{{ new Date(props.currentEndDate).toLocaleDateString('vi-VN') }}</span>
      · Giá thuê: <span class="text-white font-medium">{{ formatCurrency(props.currentMonthlyRent) }}</span>
    </div>

    <!-- Mode -->
    <div>
      <label :class="labelClass">Hình thức gia hạn</label>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          :class="clsx('px-3 py-2 text-sm rounded-md border transition-colors', form.mode === 'extend' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')"
          @click="form.mode = 'extend'"
        >
          Gia hạn đơn giản
        </button>
        <button
          type="button"
          :class="clsx('px-3 py-2 text-sm rounded-md border transition-colors', form.mode === 'new_contract' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')"
          @click="form.mode = 'new_contract'"
        >
          Hợp đồng mới
        </button>
      </div>
      <p class="mt-1.5 text-xs text-zinc-500">
        <template v-if="form.mode === 'extend'">Gia hạn tại chỗ — cùng hợp đồng, cập nhật ngày kết thúc.</template>
        <template v-else>Tạo hợp đồng kế tiếp — hợp đồng hiện tại chuyển sang trạng thái "đã gia hạn".</template>
      </p>
    </div>

    <!-- New end date -->
    <div>
      <label :class="labelClass">Ngày kết thúc mới <span class="text-red-400">*</span></label>
      <input v-model="form.new_end_date" type="date" :class="clsx(inputClass, fieldErrors.new_end_date && 'border-red-500')" >
      <p v-if="fieldErrors.new_end_date" :class="errorClass">{{ fieldErrors.new_end_date }}</p>
    </div>

    <!-- New rent -->
    <div>
      <label :class="labelClass">
        Giá thuê mới (VND)
        <span v-if="form.mode === 'new_contract'" class="text-red-400">*</span>
        <span v-else class="text-zinc-500 font-normal">(tuỳ chọn)</span>
      </label>
      <input
        v-model="form.new_monthly_rent"
        type="number"
        min="0"
        step="100000"
        :placeholder="`Mặc định: ${formatCurrency(props.currentMonthlyRent)}`"
        :class="clsx(inputClass, fieldErrors.new_monthly_rent && 'border-red-500')"
      >
      <p v-if="fieldErrors.new_monthly_rent" :class="errorClass">{{ fieldErrors.new_monthly_rent }}</p>
    </div>

    <!-- Reason -->
    <div>
      <label :class="labelClass">Lý do gia hạn (tuỳ chọn)</label>
      <textarea v-model="form.reason" rows="2" :class="inputClass" placeholder="Ghi chú lý do gia hạn..." />
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        @click="emit('cancel')"
      >
        Huỷ
      </button>
      <button
        type="submit"
        :disabled="props.loading"
        class="px-4 py-2 text-sm font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ props.loading ? 'Đang xử lý...' : (form.mode === 'extend' ? 'Gia hạn' : 'Tạo hợp đồng mới') }}
      </button>
    </div>
  </form>
</template>
