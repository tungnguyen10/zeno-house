<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  contract: ContractWithDetails
  paidAmount?: number
}>()

const emit = defineEmits<{
  renew: []
  terminate: []
}>()

function monthDiff(start: string, end = new Date()) {
  const from = new Date(start)
  return Math.max(0, (end.getFullYear() - from.getFullYear()) * 12 + end.getMonth() - from.getMonth() + 1)
}

const monthsElapsed = computed(() => monthDiff(props.contract.startDate))
const depositBalance = computed(() => Math.max(0, props.contract.deposit - (props.paidAmount ?? 0)))
</script>

<template>
  <section class="rounded-xl border border-dark-border bg-dark-surface p-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-2xl font-semibold text-white">{{ contract.contractCode }}</h1>
          <UiStatusBadge :status="contract.status" />
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{{ contract.room.buildingName }}</span>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="`/rooms/${contract.room.code}`" class="text-cyan hover:underline">
            Phòng {{ contract.room.roomNumber }}
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="`/tenants/${contract.tenant.code}`" class="text-cyan hover:underline">
            {{ contract.tenant.fullName }}
          </NuxtLink>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UiButton v-if="contract.status === 'active'" variant="secondary" size="sm" @click="emit('renew')">
          Gia hạn
        </UiButton>
        <UiButton v-if="contract.status === 'active'" variant="danger" size="sm" @click="emit('terminate')">
          Kết thúc sớm
        </UiButton>
      </div>
    </div>

    <dl class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="text-xs uppercase tracking-wide text-muted">Khách thuê</dt>
        <dd class="mt-1 truncate text-base font-medium text-white">
          <NuxtLink :to="`/tenants/${contract.tenant.code}`" class="hover:text-cyan">{{ contract.tenant.fullName }}</NuxtLink>
        </dd>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="text-xs uppercase tracking-wide text-muted">Phòng</dt>
        <dd class="mt-1 truncate text-base font-medium text-white">
          <NuxtLink :to="`/rooms/${contract.room.code}`" class="hover:text-cyan">
            {{ contract.room.buildingName }} - {{ contract.room.roomNumber }}
          </NuxtLink>
        </dd>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="text-xs uppercase tracking-wide text-muted">Đã đi qua</dt>
        <dd class="mt-1 text-2xl font-semibold text-white">{{ monthsElapsed }} tháng</dd>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="text-xs uppercase tracking-wide text-muted">Đã thu / còn cọc</dt>
        <dd class="mt-1 text-sm font-semibold text-white">
          {{ formatCurrency(paidAmount ?? 0) }}
          <span class="text-muted">/ {{ formatCurrency(depositBalance) }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
