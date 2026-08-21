<script setup lang="ts">
import type { TenantContractAmendmentSummary } from '~/types/contract-amendments'
import { contractAmendmentDiff } from '~/utils/contract-amendments'
import { formatViDate } from '~/utils/format/time'

defineProps<{ amendments: TenantContractAmendmentSummary[] }>()

const STATUS_LABEL = {
  scheduled: 'Sắp hiệu lực',
  applied: 'Đang áp dụng',
} as const

const STATUS_CLASS = {
  scheduled: 'bg-portal-warning/10 text-portal-warning-ink',
  applied: 'bg-portal-positive/10 text-portal-positive-ink',
} as const
</script>

<template>
  <section aria-labelledby="contract-amendments-title">
    <div class="mb-2 px-1">
      <h2 id="contract-amendments-title" class="portal-type-heading text-title">Phụ lục hợp đồng</h2>
      <p class="portal-type-caption mt-0.5 text-body">Lịch sử thay đổi đã được ban hành</p>
    </div>
    <div class="space-y-3">
      <PortalCard v-for="amendment in amendments" :key="amendment.id" :padded="false">
        <article class="px-4 py-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="portal-type-caption font-semibold uppercase tracking-wide text-body">Phụ lục số {{ amendment.sequenceNo }}</p>
              <h3 class="portal-type-heading mt-0.5 text-title">{{ amendment.title }}</h3>
            </div>
            <span class="rounded-full px-2.5 py-1 portal-type-caption font-semibold" :class="STATUS_CLASS[amendment.status]">
              {{ STATUS_LABEL[amendment.status] }}
            </span>
          </div>
          <p class="portal-type-caption mt-2 text-body">Hiệu lực {{ formatViDate(amendment.effectiveDate) }}</p>
          <p v-if="amendment.publicContent.trim()" class="portal-type-body mt-3 whitespace-pre-line break-words text-title">{{ amendment.publicContent }}</p>

          <dl class="mt-4 divide-y divide-border-light border-y border-border-light">
            <div
              v-for="row in contractAmendmentDiff(amendment.changes, amendment.beforeTerms, amendment.afterTerms)"
              :key="row.key"
              class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3"
            >
              <dt class="portal-type-body text-body">{{ row.label }}</dt>
              <dd class="text-right">
                <span class="portal-type-caption block text-body line-through">{{ row.before }}</span>
                <span class="portal-type-body font-semibold text-title">{{ row.after }}</span>
              </dd>
            </div>
          </dl>
        </article>
      </PortalCard>
    </div>
  </section>
</template>
