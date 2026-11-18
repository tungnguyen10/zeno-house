<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import { normalizeTenantPhone } from '~/utils/tenant-identity'
import { toTenantSummary } from '~/composables/tenants/useTenantQuickCreate'
import { useTenantLinkVerify } from '~/composables/tenants/useTenantLinkVerify'
import TenantLinkVerifyRow from '~/components/tenants/TenantLinkVerifyRow.vue'
import { useAuthStore } from '~/stores/auth'

const NEW_ID = '__new__'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  excludeTenantIds?: string[]
  excludeContractId?: string
  /** Building of the contract; enables verifying a former tenant of another owner. */
  buildingId?: string | null
  disabled?: boolean
  error?: string
  required?: boolean
  id?: string
}>(), { label: 'Khách thuê', excludeTenantIds: () => [], buildingId: null })

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'update:linkToken': [token: string | null]
  'selected': [tenant: TenantSummary | null]
}>()

const authStore = useAuthStore()
const canCreate = computed(() => authStore.can('tenants.create'))
const results = ref<TenantSummary[]>([])
const loading = ref(false)
const selected = ref<TenantSummary | null>(null)
const dialog = reactive({ open: false, name: '', phone: '' })
// Phone of an unmatched search: the only input from which a former tenant can be verified.
const verifyPhone = ref<string | null>(null)
const proof = ref('')
const verifyError = ref<string | null>(null)
const verified = ref(false)
const stale = ref(false)
// True when the row is shown under the field (popup closed), e.g. after a quick-create conflict.
const handoff = ref(false)
const { verifying, verify } = useTenantLinkVerify()
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
    if (q) {
      const phone = props.buildingId ? normalizeTenantPhone(q) : null
      openVerify(phone && options.value.length === 0 ? phone : null)
    }
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
  try {
    const res = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)
    selected.value = toTenantSummary(res.data)
  }
  catch (error) {
    // A tenant linked by verification is not visible again until its contract exists.
    if ((error as { statusCode?: number }).statusCode === 404) markStale()
  }
}, { immediate: true })

watch(() => props.buildingId, (next, prev) => {
  if (verified.value && next !== prev) markStale()
})

function markStale() {
  select(null)
  stale.value = true
}

function openVerify(phone: string | null, initialProof = '', fromDialog = false) {
  verifyPhone.value = phone
  proof.value = initialProof
  verifyError.value = null
  handoff.value = fromDialog
}

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

function select(tenant: TenantSummary | null, linkToken: string | null = null) {
  selected.value = tenant
  verified.value = Boolean(tenant && linkToken)
  stale.value = false
  if (tenant) openVerify(null)
  emit('update:modelValue', tenant?.id ?? null)
  emit('update:linkToken', linkToken)
  emit('selected', tenant)
}

function onCreated(tenant: TenantSummary) {
  dialog.open = false
  select(tenant)
}

function onNeedsVerify(payload: { phone: string; proof: string }) {
  dialog.open = false
  openVerify(normalizeTenantPhone(payload.phone), payload.proof, true)
}

async function onVerify(closePopup?: () => void) {
  if (!verifyPhone.value || !props.buildingId || !proof.value.trim()) return
  const result = await verify({ building_id: props.buildingId, phone: verifyPhone.value, proof: proof.value.trim() })
  if (result.kind === 'error') {
    verifyError.value = result.message
    return
  }
  results.value = [result.tenant]
  select(result.tenant, result.linkToken)
  closePopup?.()
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
    >
      <!-- Inside the popup: the open list would otherwise cover this row. -->
      <template v-if="!handoff && verifyPhone && !selected" #footer="{ close }">
        <TenantLinkVerifyRow
          v-model:proof="proof"
          :phone="verifyPhone"
          :verifying="verifying"
          :disabled="disabled"
          :error="verifyError"
          @submit="onVerify(close)"
        />
      </template>
    </UiCombobox>

    <p v-if="verified && selected" data-test="tenant-link-verified" class="mt-1.5 flex items-center gap-1 text-xs text-status-success">
      <IconCheckSmall class="size-3.5 shrink-0" aria-hidden="true" />
      Đã xác minh hồ sơ khách cũ
    </p>
    <p v-else-if="stale && !selected" data-test="tenant-link-stale" class="mt-1.5 text-xs text-status-warning">
      Cần chọn hoặc xác minh lại khách
    </p>

    <!-- Not a <form>: the picker is often nested inside another form. -->
    <TenantLinkVerifyRow
      v-if="handoff && verifyPhone && !selected"
      v-model:proof="proof"
      class="mt-2 rounded-lg border border-ui-border bg-ui-deep/40 p-3"
      :phone="verifyPhone"
      :verifying="verifying"
      :disabled="disabled"
      :error="verifyError"
      @submit="onVerify()"
    />

    <TenantQuickCreateDialog
      :open="dialog.open"
      :initial-name="dialog.name"
      :initial-phone="dialog.phone"
      :linkable="Boolean(buildingId)"
      @created="onCreated"
      @needs-verify="onNeedsVerify"
      @close="dialog.open = false"
    />
  </div>
</template>
