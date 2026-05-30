<script setup lang="ts">
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

defineProps<{
  services: ContractService[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', id: string, data: ContractServiceUpdateInput): void
}>()

function subtotal(s: ContractService): number {
  return s.isEnabled ? s.amount * s.quantity : 0
}

function handleAmountBlur(s: ContractService, event: Event) {
  const amount = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(amount) && amount >= 0) {
    emit('update', s.id, { amount })
  }
}

function handleQuantityBlur(s: ContractService, event: Event) {
  const quantity = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(quantity) && quantity >= 1) {
    emit('update', s.id, { quantity })
  }
}

function handleToggle(s: ContractService) {
  emit('update', s.id, { is_enabled: !s.isEnabled })
}

function handleNotesBlur(s: ContractService, event: Event) {
  const notes = (event.target as HTMLInputElement).value.trim() || null
  emit('update', s.id, { notes })
}
</script>

<template>
  <div class="overflow-x-auto">
    <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Đang tải...</div>
    <div v-else-if="services.length === 0" class="py-8 text-center text-sm text-gray-500">
      Chưa có dịch vụ nào được cấu hình cho hợp đồng này
    </div>
    <table v-else class="min-w-full divide-y divide-gray-200 text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-gray-700">Dịch vụ</th>
          <th class="px-4 py-3 text-right font-medium text-gray-700">Đơn giá</th>
          <th class="px-4 py-3 text-right font-medium text-gray-700">Số lượng</th>
          <th class="px-4 py-3 text-right font-medium text-gray-700">Thành tiền</th>
          <th class="px-4 py-3 text-center font-medium text-gray-700">Bật/Tắt</th>
          <th class="px-4 py-3 text-left font-medium text-gray-700">Ghi chú</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 bg-white">
        <tr v-for="s in services" :key="s.id" :class="[!s.isEnabled && 'opacity-50']">
          <td class="px-4 py-3 font-medium text-gray-900">{{ s.catalog.name }}</td>
          <td class="px-4 py-3 text-right">
            <input
              type="number"
              min="0"
              step="1000"
              :value="s.amount"
              class="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
              @blur="handleAmountBlur(s, $event)"
            >
          </td>
          <td class="px-4 py-3 text-right">
            <input
              type="number"
              min="1"
              :value="s.quantity"
              class="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
              @blur="handleQuantityBlur(s, $event)"
            >
          </td>
          <td class="px-4 py-3 text-right font-medium text-gray-900">
            {{ subtotal(s).toLocaleString('vi-VN') }}đ
          </td>
          <td class="px-4 py-3 text-center">
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                s.isEnabled ? 'bg-blue-600' : 'bg-gray-200',
              ]"
              :aria-label="`Bật/tắt ${s.catalog.name}`"
              @click="handleToggle(s)"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  s.isEnabled ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </td>
          <td class="px-4 py-3">
            <input
              type="text"
              :value="s.notes ?? ''"
              placeholder="Ghi chú..."
              class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              @blur="handleNotesBlur(s, $event)"
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
