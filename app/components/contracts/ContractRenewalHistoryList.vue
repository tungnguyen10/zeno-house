<script setup lang="ts">
import type { ContractRenewal } from '~/types/contract-renewals'
import { formatCurrency } from '~/utils/format/currency'
import { CONTRACT_RENEWAL_MODE_LABELS } from '~/utils/constants/contracts'

defineProps<{
  renewals: ContractRenewal[]
  isLoading: boolean
  previousContractId: string | null
  renewalCount: number
}>()
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-ui-primary">Lịch sử gia hạn</p>
        <p class="mt-0.5 text-xs text-ui-muted">Các lần gia hạn và hợp đồng kế tiếp.</p>
      </div>
      <span v-if="renewalCount > 0" class="text-xs text-ui-muted">{{ renewalCount }} lần</span>
    </div>

    <div v-if="previousContractId" class="mb-3 text-xs text-ui-muted">
      Hợp đồng trước:
      <NuxtLink :to="`/dashboard/contracts/${previousContractId}`" class="text-ui-accent hover:text-ui-primary transition-colors font-mono ml-1">
        {{ previousContractId.slice(0, 8) }}...
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton class="h-10 rounded-lg" />
    </div>
    <div v-else-if="renewals.length === 0" class="text-sm text-ui-muted text-center py-3">
      Chưa có lịch sử gia hạn.
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="renewal in renewals"
        :key="renewal.id"
        class="rounded-lg border border-ui-border px-4 py-3"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-ui-primary">{{ CONTRACT_RENEWAL_MODE_LABELS[renewal.mode] ?? renewal.mode }}</p>
            <p class="text-xs text-ui-muted mt-0.5">
              {{ new Date(renewal.oldEndDate).toLocaleDateString('vi-VN') }}
              → {{ new Date(renewal.newEndDate).toLocaleDateString('vi-VN') }}
            </p>
            <p v-if="renewal.oldMonthlyRent !== renewal.newMonthlyRent" class="text-xs text-ui-muted mt-0.5">
              Giá: {{ formatCurrency(renewal.oldMonthlyRent) }} → {{ formatCurrency(renewal.newMonthlyRent) }}
            </p>
            <p v-if="renewal.reason" class="text-xs text-ui-muted italic mt-0.5">{{ renewal.reason }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xs text-ui-muted">{{ new Date(renewal.createdAt).toLocaleDateString('vi-VN') }}</p>
            <NuxtLink
              v-if="renewal.newContractId"
              :to="`/dashboard/contracts/${renewal.newContractId}`"
              class="text-xs text-ui-accent hover:text-ui-primary transition-colors mt-0.5 block"
            >
              Xem hợp đồng mới →
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
