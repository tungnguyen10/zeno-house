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

// Tenant search
const tenantSearch = ref('')
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({
    q: tenantSearch.value || undefined,
    limit: 50,
    available: props.available ? true : undefined,
  })),
  watch: [tenantSearch],
})
const filteredTenants = computed(() => {
  const excluded = new Set(props.excludeTenantIds ?? [])
  return (tenantsData.value?.data ?? []).filter(t => !excluded.has(t.id))
})
const selectedTenant = computed(() => filteredTenants.value.find(t => t.id === form.tenant_id))

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
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Khách thuê <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>

      <!-- Selected chip -->
      <div
        v-if="selectedTenant"
        class="flex items-center justify-between px-3 py-2.5 rounded-lg border border-cyan/30 bg-cyan/5"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="size-8 rounded-full bg-cyan/10 flex items-center justify-center shrink-0">
            <span class="text-cyan text-xs font-bold">{{ selectedTenant.fullName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-white">{{ selectedTenant.fullName }}</p>
            <p class="text-xs text-muted">{{ selectedTenant.phone }}</p>
          </div>
        </div>
        <button
          type="button"
          :disabled="loading"
          class="text-muted hover:text-white transition-colors shrink-0 ml-2 disabled:opacity-40"
          @click="form.tenant_id = ''"
        >
          ✕
        </button>
      </div>

      <!-- Search + list -->
      <div
        :class="[
          'rounded-lg border overflow-hidden',
          fieldErrors.tenant_id ? 'border-error/50' : 'border-dark-border',
        ]"
      >
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">🔍</span>
          <input
            v-model="tenantSearch"
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            :disabled="loading"
            class="block w-full pl-7 pr-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-0 text-sm border-b border-dark-border disabled:text-muted disabled:cursor-not-allowed"
          >
        </div>
        <div class="max-h-44 overflow-y-auto bg-dark-surface">
          <button
            v-for="t in filteredTenants"
            :key="t.id"
            type="button"
            :disabled="loading"
            :class="[
              'flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors text-sm border-b border-dark-border/50 last:border-0',
              form.tenant_id === t.id ? 'bg-cyan/10' : 'hover:bg-dark-hover',
            ]"
            @click="form.tenant_id = t.id"
          >
            <div class="size-7 rounded-full bg-dark-hover flex items-center justify-center shrink-0 text-xs font-bold text-muted">
              {{ t.fullName.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p :class="['font-medium truncate', form.tenant_id === t.id ? 'text-cyan' : 'text-white']">
                {{ t.fullName }}
              </p>
              <p class="text-xs text-muted">{{ t.phone }}</p>
            </div>
          </button>
          <div v-if="filteredTenants.length === 0" class="px-3 py-5 text-center text-muted text-sm">
            Không tìm thấy khách thuê nào
          </div>
        </div>
      </div>
      <p v-if="fieldErrors.tenant_id" class="text-xs text-error">{{ fieldErrors.tenant_id }}</p>
    </div>

    <!-- Move-in date -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Ngày vào ở <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>
      <input
        v-model="form.move_in_date"
        type="date"
        :disabled="loading"
        :class="[
          'block w-full px-3 py-2 rounded-lg border bg-dark-surface text-white focus:outline-none focus:border-cyan text-sm transition-colors disabled:text-muted disabled:cursor-not-allowed',
          fieldErrors.move_in_date ? 'border-error/50' : 'border-dark-border',
        ]"
      >
      <p v-if="fieldErrors.move_in_date" class="text-xs text-error">{{ fieldErrors.move_in_date }}</p>
    </div>

    <!-- Billing counted -->
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        v-model="form.billing_counted"
        type="checkbox"
        :disabled="loading"
        class="size-4 rounded border-dark-border bg-dark-surface accent-cyan"
      >
      <span class="text-sm text-white">Tính vào phí theo đầu người</span>
    </label>

    <!-- API error -->
    <p v-if="apiError" class="text-sm text-error">{{ apiError }}</p>

    <!-- Actions -->
    <div class="flex gap-2 pt-1">
      <UiButton type="submit" size="sm" :loading="loading">Thêm người ở</UiButton>
      <UiButton type="button" variant="secondary" size="sm" :disabled="loading" @click="emit('cancel')">Huỷ</UiButton>
    </div>
  </form>
</template>
