<script setup lang="ts">
import type { BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'
import { READINESS_LABELS } from '~/utils/constants/readiness'

const props = defineProps<{
  readiness: BuildingReadiness
  settingsPath: string
  editPath: string
}>()

const bothReady = computed(() => props.readiness.contract.ready && props.readiness.billing.ready)
const openContract = ref(false)
const openBilling = ref(false)

function hrefFor(code: ReadinessCode): string {
  const { anchor } = READINESS_LABELS[code]
  return anchor === 'edit' ? props.editPath : `${props.settingsPath}#${anchor}`
}
function labelFor(code: ReadinessCode): string {
  return READINESS_LABELS[code].label
}
</script>

<template>
  <UiSurfacePanel as="section">
    <div v-if="bothReady" data-test="readiness-compact" class="flex items-center gap-2 text-sm text-ui-primary">
      <span aria-hidden="true">✓</span>
      Sẵn sàng lập hợp đồng và xuất hóa đơn
    </div>

    <div v-else class="space-y-3">
      <h3 class="text-sm font-semibold text-ui-primary">Sẵn sàng vận hành</h3>

      <div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-ui-primary">Lập hợp đồng</span>
          <span v-if="readiness.contract.ready" class="text-sm text-status-success" aria-hidden="true">✓ Đủ</span>
          <button
            v-else
            type="button"
            data-test="readiness-contract-toggle"
            @click="openContract = !openContract"
          >
            <UiBadge variant="warning">Thiếu {{ readiness.contract.missing.length }} mục</UiBadge>
          </button>
        </div>
        <ul v-if="openContract && !readiness.contract.ready" class="mt-2 space-y-1 pl-1">
          <li v-for="code in readiness.contract.missing" :key="code">
            <NuxtLink :to="hrefFor(code)" class="text-xs text-ui-accent hover:underline">{{ labelFor(code) }}</NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-ui-primary">Xuất hóa đơn</span>
          <span v-if="readiness.billing.ready" class="text-sm text-status-success" aria-hidden="true">✓ Đủ</span>
          <button
            v-else
            type="button"
            data-test="readiness-billing-toggle"
            @click="openBilling = !openBilling"
          >
            <UiBadge variant="warning">Thiếu {{ readiness.billing.missing.length }} mục</UiBadge>
          </button>
        </div>
        <ul v-if="openBilling && !readiness.billing.ready" class="mt-2 space-y-1 pl-1">
          <li v-for="code in readiness.billing.missing" :key="code">
            <NuxtLink :to="hrefFor(code)" class="text-xs text-ui-accent hover:underline">{{ labelFor(code) }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </UiSurfacePanel>
</template>
