<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { HandoverInventory } from '~/types/inventory'

const props = defineProps<{ contractId: string }>()

const data = ref<HandoverInventory | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await apiFetch<ApiSuccess<HandoverInventory>>(`/api/contracts/${encodeURIComponent(props.contractId)}/handover-inventory`)
    data.value = res.data
  }
  finally {
    loading.value = false
  }
}

watch(() => props.contractId, load, { immediate: true })

const items = computed(() => data.value?.items ?? [])
const sourceNote = computed(() => {
  const d = data.value
  if (d?.sourceContractId && d.sourceContractId !== props.contractId) {
    return `Theo biên bản bàn giao của hợp đồng ${d.sourceContractCode}`
  }
  return null
})
</script>

<template>
  <div class="space-y-3">
    <p v-if="sourceNote" class="text-xs text-ui-muted">{{ sourceNote }}</p>
    <p v-if="items.length === 0" class="text-sm text-ui-muted">Không có dữ liệu bàn giao</p>
    <InventoryItemsList v-else :items="items" />
  </div>
</template>
