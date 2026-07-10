<script setup lang="ts">
import type { BillingAuditEvent } from '~/types/billing'
import { auditCategoryForAction, auditCategoryVisual } from '~/utils/billing/audit-category'
import { auditEntityLink } from '~/utils/billing/audit-entity-link'
import {
  formatAuditTime,
  auditActorLabel,
  hasAuditTechnicalDetail,
  auditTechnicalJson,
  formatDiffVal,
  buildAuditDiff,
} from '~/utils/billing/audit-display'

const props = defineProps<{
  event: BillingAuditEvent
}>()

defineEmits<{
  (e: 'filterCorrelation', id: string): void
}>()

const category = computed(() => auditCategoryForAction(props.event.action))
const visual = computed(() => auditCategoryVisual(category.value))
const entityLink = computed(() => auditEntityLink(props.event))
const diff = computed(() => buildAuditDiff(props.event))
const expanded = ref(false)
</script>

<template>
  <div class="flex gap-3 py-3 px-1 group">
    <!-- Leading icon bubble (D3) -->
    <div
      :class="['flex-none flex h-7 w-7 items-center justify-center rounded-full mt-0.5', visual.bubbleClass]"
      :title="visual.label"
    >
      <IconPlus v-if="category === 'create'" :class="['h-4 w-4', visual.iconClass]" aria-hidden="true" />
      <IconPencilSquare v-else-if="category === 'edit'" :class="['h-4 w-4', visual.iconClass]" aria-hidden="true" />
      <IconXCircle v-else-if="category === 'destructive'" :class="['h-4 w-4', visual.iconClass]" aria-hidden="true" />
      <IconCheckCircle v-else-if="category === 'status'" :class="['h-4 w-4', visual.iconClass]" aria-hidden="true" />
      <IconInfoCircle v-else :class="['h-4 w-4', visual.iconClass]" aria-hidden="true" />
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1 space-y-0.5">
      <!-- Summary line -->
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm text-white leading-snug">
          {{ event.summary ?? event.action }}
        </p>
        <time class="flex-none text-xs text-muted tabular-nums whitespace-nowrap mt-0.5">
          {{ formatAuditTime(event.createdAt) }}
        </time>
      </div>

      <!-- Actor + entity -->
      <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span :title="event.actorEmail ?? undefined">{{ auditActorLabel(event) }}</span>
        <NuxtLink
          v-if="entityLink"
          :to="entityLink"
          class="text-cyan-400 hover:underline underline-offset-2"
        >
          {{ event.entityLabel ?? event.entityType }}
          <span v-if="event.entitySubLabel" class="text-muted ml-1">{{ event.entitySubLabel }}</span>
        </NuxtLink>
        <span v-else-if="event.entityLabel">
          {{ event.entityLabel }}
          <span v-if="event.entitySubLabel" class="text-muted ml-1">{{ event.entitySubLabel }}</span>
        </span>
      </div>

      <!-- Diff view (D6) -->
      <div v-if="diff" class="mt-1 flex items-center gap-2 text-xs rounded bg-dark-surface px-2 py-1 font-mono w-fit max-w-full">
        <span class="text-muted">{{ diff.label }}:</span>
        <span class="text-rose-300 line-through">{{ formatDiffVal(diff.before) }}</span>
        <span class="text-muted">→</span>
        <span class="text-emerald-300">{{ formatDiffVal(diff.after) }}</span>
        <span v-if="diff.delta != null" class="text-muted">({{ typeof diff.delta === 'number' && diff.delta > 0 ? '+' : '' }}{{ formatDiffVal(diff.delta) }})</span>
      </div>

      <!-- Action row: category chip + correlation + entity link + expand -->
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <span
          :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', visual.badgeClass]"
        >
          {{ visual.label }}
        </span>

        <!-- Correlation (D7) -->
        <UiButton
          v-if="event.correlationId"
          unstyled
          class="text-xs text-muted hover:text-white underline underline-offset-2 transition-colors"
          :title="`Xem cùng correlation: ${event.correlationId}`"
          @click="$emit('filterCorrelation', event.correlationId)"
        >
          Xem cùng nhóm
        </UiButton>

        <!-- Entity quick-open (D8) -->
        <NuxtLink
          v-if="entityLink"
          :to="entityLink"
          class="text-xs text-muted hover:text-white transition-colors"
        >
          → Mở
        </NuxtLink>

        <!-- Technical details expand -->
        <UiButton
          v-if="hasAuditTechnicalDetail(event)"
          unstyled
          class="text-xs text-muted hover:text-white transition-colors ml-auto"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Ẩn' : 'Chi tiết kỹ thuật' }}
        </UiButton>
      </div>

      <!-- Technical JSON (collapsible) -->
      <pre
        v-if="expanded"
        class="mt-2 rounded bg-dark-surface text-xs text-muted p-2 overflow-x-auto whitespace-pre-wrap break-all"
      >{{ auditTechnicalJson(event) }}</pre>
    </div>
  </div>
</template>
