<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { HandoverInventory } from '~/types/inventory'
import { getApiErrorMessage } from '~/utils/api-error'

const props = withDefaults(defineProps<{
  contractId: string
  /** Render only the list, for use inside another section. */
  embedded?: boolean
}>(), {
  embedded: false,
})

const data = ref<HandoverInventory | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = (await apiFetch<ApiSuccess<HandoverInventory>>(`/api/contracts/${props.contractId}/handover-inventory`)).data
  }
  catch (e: unknown) {
    error.value = getApiErrorMessage(e, 'Không tải được nội thất bàn giao.')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.contractId, load)

const sourceNote = computed(() => {
  const source = data.value
  if (!source?.sourceContractId || source.sourceContractId === props.contractId) return null
  return `Theo biên bản bàn giao của hợp đồng ${source.sourceContractCode}`
})
</script>

<template>
  <div v-if="embedded">
    <UiSkeleton v-if="loading" class="h-20 rounded-lg" />
    <UiAlert v-else-if="error" severity="danger">{{ error }}</UiAlert>
    <InventoryItemsList
      v-else
      :items="data?.items ?? []"
      :source-note="sourceNote"
      empty-text="Không có dữ liệu bàn giao"
    />
  </div>
  <UiSection v-else title="Nội thất bàn giao">
    <UiSurfacePanel density="compact">
      <UiSkeleton v-if="loading" class="h-20 rounded-lg" />
      <UiAlert v-else-if="error" severity="danger">{{ error }}</UiAlert>
      <InventoryItemsList
        v-else
        :items="data?.items ?? []"
        :source-note="sourceNote"
        empty-text="Không có dữ liệu bàn giao"
      />
    </UiSurfacePanel>
  </UiSection>
</template>
