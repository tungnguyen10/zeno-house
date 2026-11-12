<script setup lang="ts">
import clsx from 'clsx'
import type { BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'
import { READINESS_LABELS } from '~/utils/constants/readiness'

const props = defineProps<{
  readiness: BuildingReadiness
  settingsPath: string
  editPath: string
}>()

const instanceId = useId()
const expanded = ref({ contract: false, billing: false })
const rows = [
  { kind: 'contract', label: 'Lập hợp đồng' },
  { kind: 'billing', label: 'Xuất hóa đơn' },
] as const

function repairPath(code: ReadinessCode) {
  const { anchor } = READINESS_LABELS[code]
  return anchor === 'edit' ? props.editPath : `${props.settingsPath}#${anchor}`
}
</script>

<template>
  <UiSurfacePanel as="section" density="compact" aria-label="Sẵn sàng vận hành">
    <p
      v-if="readiness.contract.ready && readiness.billing.ready"
      data-test="readiness-compact"
      class="text-sm text-ui-primary"
    >
      Sẵn sàng lập hợp đồng và xuất hóa đơn
    </p>
    <template v-else>
      <h2 class="mb-2 text-sm font-semibold text-ui-primary">Sẵn sàng vận hành</h2>
      <div class="divide-y divide-ui-border">
        <div v-for="row in rows" :key="row.kind" class="py-1">
          <div v-if="readiness[row.kind].ready" class="flex min-h-11 items-center justify-between gap-3 px-2 text-sm">
            <span class="text-ui-primary">{{ row.label }}</span>
            <span class="shrink-0 text-ui-muted"><span aria-hidden="true">✓ </span>Sẵn sàng</span>
          </div>
          <template v-else>
            <UiButton
              unstyled
              class="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-ui-primary hover:bg-ui-hover active:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
              :data-test="`readiness-${row.kind}-toggle`"
              :aria-expanded="expanded[row.kind]"
              :aria-controls="`${instanceId}-${row.kind}-missing`"
              @click="expanded[row.kind] = !expanded[row.kind]"
            >
              <span>{{ row.label }}</span>
              <span class="flex shrink-0 items-center gap-2">
                <UiBadge variant="warning">Thiếu {{ readiness[row.kind].missing.length }} mục</UiBadge>
                <IconChevronDown :class="clsx('h-4 w-4 text-ui-muted', expanded[row.kind] && 'rotate-180')" aria-hidden="true" />
              </span>
            </UiButton>
            <ul
              :id="`${instanceId}-${row.kind}-missing`"
              :hidden="!expanded[row.kind]"
              class="space-y-1 px-2 pb-2"
              :aria-label="`${row.label}: thông tin còn thiếu`"
            >
              <li v-for="code in readiness[row.kind].missing" :key="code">
                <NuxtLink
                  :to="repairPath(code)"
                  class="flex min-h-11 items-center rounded-md px-2 py-2 text-sm text-ui-accent underline underline-offset-4 hover:bg-ui-hover active:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
                >
                  {{ READINESS_LABELS[code].label }}
                </NuxtLink>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </template>
  </UiSurfacePanel>
</template>
