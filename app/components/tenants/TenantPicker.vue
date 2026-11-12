<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import { normalizeTenantPhone } from '~/utils/tenant-identity'
import { toTenantSummary } from '~/composables/tenants/useTenantQuickCreate'
import { useAuthStore } from '~/stores/auth'

const NEW_ID = '__new__'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  excludeTenantIds?: string[]
  excludeContractId?: string
  disabled?: boolean
  error?: string
  required?: boolean
  id?: string
}>(), { label: 'Khách thuê', excludeTenantIds: () => [] })

const emit = defineEmits<{ 'update:modelValue': [id: string | null]; selected: [tenant: TenantSummary | null] }>()

const authStore = useAuthStore()
const canCreate = computed(() => authStore.can('tenants.create'))
const results = ref<TenantSummary[]>([])
const loading = ref(false)
const selected = ref<TenantSummary | null>(null)
const dialog = reactive({ open: false, name: '', phone: '' })
let timer: ReturnType<typeof setTimeout> | undefined

const options = computed(() => {
  const excluded = new Set(props.excludeTenantIds)
  return results.value.filter(o => !excluded.has(o.id))
})

async function runSearch(q: string) {
  loading.value = true
  try {
    const res = await apiFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
      query: { q: q || undefined, available: true, limit: 20, excludeContractId: props.excludeContractId || undefined },
    })
    results.value = res.data.map(toTenantSummary)
  }
  finally {
    loading.value = false
  }
}

function onSearch(q: string) {
  clearTimeout(timer)
  timer = setTimeout(() => runSearch(q), 250)
}

watch(() => props.modelValue, async (id) => {
  if (!id) { selected.value = null; return }
  if (selected.value?.id === id) return
  const hit = results.value.find(r => r.id === id)
  if (hit) { selected.value = hit; return }
  const res = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)
  selected.value = toTenantSummary(res.data)
}, { immediate: true })

function createOption(query: string): TenantSummary {
  return { id: NEW_ID, code: '', fullName: query, phone: '' }
}

function onChoose(option: TenantSummary | null) {
  if (option?.id === NEW_ID) {
    const isPhone = normalizeTenantPhone(option.fullName) !== null
    dialog.name = isPhone ? '' : option.fullName
    dialog.phone = isPhone ? option.fullName : ''
    dialog.open = true
    return
  }
  select(option)
}

function select(tenant: TenantSummary | null) {
  selected.value = tenant
  emit('update:modelValue', tenant?.id ?? null)
  emit('selected', tenant)
}

function onCreated(tenant: TenantSummary) {
  dialog.open = false
  select(tenant)
}

onMounted(() => runSearch(''))
</script>

<template>
  <div>
    <UiCombobox
      :id="id"
      :model-value="selected"
      :options="options"
      :option-key="(o: TenantSummary) => o.id"
      :option-label="(o: TenantSummary) => `${o.fullName} — ${o.phone}`"
      :label="label"
      placeholder="Tìm và chọn khách thuê..."
      search-placeholder="Tìm theo tên hoặc số điện thoại..."
      remote-search
      :allow-custom="canCreate"
      :create-option="createOption"
      custom-option-label="Thêm khách mới:"
      :loading="loading"
      :disabled="disabled"
      :required="required"
      :error="error"
      empty-message="Không tìm thấy khách thuê"
      @search="onSearch"
      @update:model-value="onChoose"
    />
    <TenantQuickCreateDialog
      :open="dialog.open"
      :initial-name="dialog.name"
      :initial-phone="dialog.phone"
      @created="onCreated"
      @close="dialog.open = false"
    />
  </div>
</template>
