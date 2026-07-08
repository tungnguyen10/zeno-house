<script setup lang="ts">
import type { Tenant } from '~/types/tenants'
import type { ContractOccupantAddInput } from '~/utils/validators/contract-occupants'
import type { ApiSuccess } from '~/types/api'

const props = defineProps<{
  loading?: boolean
  apiError?: string | null
  excludeTenantIds?: string[]
  /** Pass true to only show tenants not currently in any active contract/occupancy */
  available?: boolean
}>()

const emit = defineEmits<{
  'submit': [value: ContractOccupantAddInput]
  'cancel': []
}>()

const form = reactive({
  tenant_id: '',
  move_in_date: new Date().toISOString().slice(0, 10),
  billing_counted: true,
})

const fieldErrors = ref<Record<string, string>>({})

// Tenant search — pre-load available tenants; UiCombobox handles client-side filtering
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({
    limit: 200,
    available: props.available ? true : undefined,
  })),
})
const filteredTenants = computed(() => {
  const excluded = new Set(props.excludeTenantIds ?? [])
  return (tenantsData.value?.data ?? []).filter(t => !excluded.has(t.id))
})
const selectedTenant = computed(() => filteredTenants.value.find(t => t.id === form.tenant_id) ?? null)

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
  })
}
</script>

<template>
  <form novalidate class="space-y-4" @submit.prevent="handleSubmit">
    <!-- Tenant picker -->
    <UiCombobox
      :model-value="selectedTenant"
      :options="filteredTenants"
      :option-key="t => t.id"
      :option-label="t => `${t.fullName} — ${t.phone}`"
      label="Khách thuê"
      placeholder="Tìm và chọn khách thuê..."
      search-placeholder="Tìm theo tên hoặc số điện thoại..."
      required
      :disabled="loading"
      :error="fieldErrors.tenant_id"
      empty-message="Không tìm thấy khách thuê nào"
      @update:model-value="t => form.tenant_id = t?.id ?? ''"
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
