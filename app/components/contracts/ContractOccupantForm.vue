<script setup lang="ts">
import type { TenantSummary } from '~/types/tenants'
import type { ContractOccupantAddInput } from '~/utils/validators/contract-occupants'

defineProps<{
  loading?: boolean
  apiError?: string | null
  excludeTenantIds?: string[]
}>()

const emit = defineEmits<{
  'submit': [value: ContractOccupantAddInput & { tenantName: string }]
  'cancel': []
}>()

const form = reactive({
  tenant_id: '',
  move_in_date: new Date().toISOString().slice(0, 10),
  billing_counted: true,
})
const tenantName = ref('')

const fieldErrors = ref<Record<string, string>>({})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.tenant_id) fieldErrors.value.tenant_id = 'Bắt buộc chọn khách thuê'
  if (!form.move_in_date) fieldErrors.value.move_in_date = 'Bắt buộc'
  return Object.keys(fieldErrors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    tenant_id: form.tenant_id,
    role: 'roommate',
    move_in_date: form.move_in_date,
    billing_counted: form.billing_counted,
    tenantName: tenantName.value,
  })
}
</script>

<template>
  <form novalidate class="space-y-4" @submit.prevent="handleSubmit">
    <!-- Tenant picker -->
    <TenantPicker
      :model-value="form.tenant_id || null"
      :exclude-tenant-ids="excludeTenantIds"
      required
      :disabled="loading"
      :error="fieldErrors.tenant_id"
      @update:model-value="(id: string | null) => form.tenant_id = id ?? ''"
      @selected="(t: TenantSummary | null) => tenantName = t?.fullName ?? ''"
    />

    <!-- Move-in date -->
    <UiDatePicker
      v-model="form.move_in_date"
      label="Ngày vào ở"
      date-mode="period-start"
      required
      :disabled="loading"
      :error="fieldErrors.move_in_date"
    />

    <!-- Billing counted -->
    <UiCheckbox
      v-model="form.billing_counted"
      label="Tính vào phí theo đầu người"
      :disabled="loading"
    />

    <!-- API error -->
    <UiAlert v-if="apiError" severity="danger">
      {{ apiError }}
    </UiAlert>

    <!-- Actions -->
    <div class="flex gap-2 pt-1">
      <UiButton type="submit" size="sm" :loading="loading">Thêm người ở</UiButton>
      <UiButton type="button" variant="secondary" size="sm" :disabled="loading" @click="emit('cancel')">Huỷ</UiButton>
    </div>
  </form>
</template>
