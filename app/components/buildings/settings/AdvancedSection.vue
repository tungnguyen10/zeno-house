<script setup lang="ts">
import type { StepListItem } from '~/utils/building-setup-steps'

defineProps<{
  steps: StepListItem[]
  openId: string | null
}>()

const emit = defineEmits<{ 'update:openId': [id: string | null] }>()
</script>

<template>
  <section aria-labelledby="advanced-heading" class="space-y-3">
    <div>
      <h2 id="advanced-heading" class="text-sm font-semibold text-ui-primary">Nâng cao</h2>
      <p class="mt-0.5 text-xs text-ui-muted">
        Dùng khi đã vận hành: mã tòa nhà, phân quyền, quy tắc tài chính và dịch vụ theo từng hợp đồng.
      </p>
    </div>
    <SettingsStepList
      :steps="steps"
      :open-id="openId"
      :numbered="false"
      @update:open-id="emit('update:openId', $event)"
    >
      <template #step-identity-access>
        <IdentityAccessSection />
      </template>
      <template v-if="steps.some(step => step.id === 'finance-rules')" #step-finance-rules>
        <FinanceRulesSection />
      </template>
      <template #step-service-overrides>
        <ServiceOverridesSection />
      </template>
    </SettingsStepList>
  </section>
</template>
