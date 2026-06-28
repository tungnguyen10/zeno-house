<script setup lang="ts">
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { formatCurrency } from '~/utils/format/currency'

interface ContractRow {
  contractId: string
  roomNumber: string
  tenantName: string
}

const props = defineProps<{
  contracts: ContractRow[]
  services: ContractService[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', id: string, data: ContractServiceUpdateInput): void
}>()

const query = ref('')
const expanded = ref<Set<string>>(new Set())

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const items = props.contracts.map((c) => {
    const list = props.services.filter(s => s.contractId === c.contractId)
    const active = list.filter(s => s.isEnabled)
    const total = active.reduce((sum, s) => sum + s.amount * s.quantity, 0)
    return {
      ...c,
      services: list,
      activeCount: active.length,
      totalCount: list.length,
      monthlyTotal: total,
    }
  })
  if (!q) return items
  return items.filter(r =>
    r.roomNumber.toLowerCase().includes(q)
    || r.tenantName.toLowerCase().includes(q),
  )
})

const allExpanded = computed(() =>
  rows.value.length > 0 && rows.value.every(r => expanded.value.has(r.contractId)),
)

function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function toggleAll() {
  if (allExpanded.value) {
    expanded.value = new Set()
  }
  else {
    expanded.value = new Set(rows.value.map(r => r.contractId))
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toolbar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex-1 sm:max-w-xs">
        <UiInput
          v-model="query"
          type="search"
          placeholder="Tìm phòng hoặc khách thuê..."
          density="compact"
        />
      </div>
      <div class="flex items-center gap-2 text-xs text-muted">
        <span>{{ rows.length }} hợp đồng active</span>
        <button
          v-if="rows.length > 0"
          type="button"
          class="rounded-md border border-dark-border px-2 py-1 text-xs text-white hover:bg-dark-hover transition-colors"
          @click="toggleAll"
        >
          {{ allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-2">
      <UiSkeleton v-for="i in 4" :key="i" class="h-14 rounded-lg" />
    </div>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="contracts.length === 0"
      title="Chưa có hợp đồng active"
      description="Khi có hợp đồng active, bạn có thể chỉnh dịch vụ từng phòng tại đây."
    />
    <UiEmptyState
      v-else-if="rows.length === 0"
      title="Không tìm thấy phòng phù hợp"
      :description="`Không có hợp đồng nào khớp với “${query}”.`"
    />

    <!-- Rows -->
    <ul v-else class="divide-y divide-dark-border overflow-hidden rounded-lg border border-dark-border bg-dark-deep/30">
      <li v-for="row in rows" :key="row.contractId">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-dark-hover/40 transition-colors focus-visible:outline-none focus-visible:bg-dark-hover/60"
          :aria-expanded="expanded.has(row.contractId)"
          :aria-controls="`svc-${row.contractId}`"
          @click="toggle(row.contractId)"
        >
          <svg
            class="h-4 w-4 shrink-0 text-muted transition-transform"
            :class="expanded.has(row.contractId) && 'rotate-90'"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" />
          </svg>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">
              Phòng {{ row.roomNumber }}
              <span class="text-muted font-normal">· {{ row.tenantName }}</span>
            </p>
          </div>
          <div class="hidden shrink-0 items-center gap-3 text-xs sm:flex">
            <span
              class="rounded-md px-2 py-0.5"
              :class="row.activeCount > 0 ? 'bg-cyan/10 text-cyan' : 'bg-dark-card text-muted'"
            >
              {{ row.activeCount }}/{{ row.totalCount }} dịch vụ
            </span>
            <span class="tabular-nums font-medium text-white min-w-[90px] text-right">
              {{ formatCurrency(row.monthlyTotal) }}
            </span>
          </div>
        </button>

        <div
          v-if="expanded.has(row.contractId)"
          :id="`svc-${row.contractId}`"
          class="border-t border-dark-border bg-dark-surface px-4 py-3"
        >
          <ContractServicesTab
            :services="row.services"
            @update="(id, data) => emit('update', id, data)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
