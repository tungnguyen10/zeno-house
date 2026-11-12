<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import { tenantCreateSchema } from '~/utils/validators/tenants'
import { toTenantSummary, useTenantQuickCreate } from '~/composables/tenants/useTenantQuickCreate'

const props = defineProps<{ open: boolean; initialName?: string; initialPhone?: string }>()
const emit = defineEmits<{ created: [tenant: TenantSummary]; close: [] }>()

const blank = () => ({
  full_name: props.initialName ?? '', phone: props.initialPhone ?? '',
  id_number: '', date_of_birth: '', id_issued_date: '', id_issued_place: '', permanent_address: '',
})
const form = reactive(blank())
const showIdentity = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const stage = ref<'form' | 'duplicate' | 'conflict'>('form')
const message = ref<string | null>(null)
const existing = ref<Tenant | null>(null)
const duplicateFields = ref<('phone' | 'id_number')[]>([])
const { submitting, submit } = useTenantQuickCreate()

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, blank())
  showIdentity.value = false
  fieldErrors.value = {}
  stage.value = 'form'
  message.value = null
  existing.value = null
  duplicateFields.value = []
})

const existingBusy = computed(() => Boolean(existing.value?.hasActiveContract || existing.value?.activeAssignment))
const duplicateFieldLabel = computed(() =>
  duplicateFields.value.includes('id_number') ? 'Số CCCD' : 'Số điện thoại',
)

async function onSubmit() {
  fieldErrors.value = {}
  message.value = null
  const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim())
  const parsed = tenantCreateSchema.safeParse({
    full_name: form.full_name.trim(), phone: form.phone,
    id_number: nullIfEmpty(form.id_number), date_of_birth: nullIfEmpty(form.date_of_birth),
    id_issued_date: nullIfEmpty(form.id_issued_date), id_issued_place: nullIfEmpty(form.id_issued_place),
    permanent_address: nullIfEmpty(form.permanent_address),
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  const result = await submit(parsed.data)
  if (result.kind === 'created') { emit('created', result.tenant); return }
  if (result.kind === 'duplicate') {
    stage.value = 'duplicate'
    duplicateFields.value = result.fields
    const res = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${result.existingTenantId}`)
    existing.value = res.data
    return
  }
  if (result.kind === 'conflict') { stage.value = 'conflict'; message.value = result.message; return }
  message.value = result.message
  for (const [k, v] of Object.entries(result.fieldErrors ?? {})) fieldErrors.value[k] = v[0]!
}

function useExisting() {
  if (existing.value && !existingBusy.value) emit('created', toTenantSummary(existing.value))
}
</script>

<template>
  <UiModal :open="open" title="Thêm khách mới" mobile-fullscreen @close="emit('close')">
    <div v-if="stage === 'form'" class="space-y-4">
      <UiInput
        data-test="qc-name"
        label="Họ tên"
        :model-value="form.full_name"
        :error="fieldErrors.full_name"
        required
        @update:model-value="(v: string) => form.full_name = v"
      />
      <UiInput
        data-test="qc-phone"
        label="Số điện thoại"
        inputmode="tel"
        :model-value="form.phone"
        :error="fieldErrors.phone"
        required
        @update:model-value="(v: string) => form.phone = v"
      />

      <button
        type="button"
        class="text-sm font-medium text-ui-accent"
        data-test="qc-toggle-id"
        @click="showIdentity = !showIdentity"
      >
        Thông tin giấy tờ (không bắt buộc)
      </button>

      <UiFormSection v-if="showIdentity" title="Thông tin giấy tờ (không bắt buộc)">
        <div class="grid gap-4 sm:grid-cols-2">
          <UiInput
            data-test="qc-id-number"
            label="Số CMND/CCCD"
            inputmode="numeric"
            :model-value="form.id_number"
            :error="fieldErrors.id_number"
            @update:model-value="(v: string) => form.id_number = v"
          />
          <UiDatePicker
            label="Ngày sinh"
            date-mode="past"
            :model-value="form.date_of_birth"
            @update:model-value="(v: string) => form.date_of_birth = v"
          />
          <UiDatePicker
            label="Ngày cấp"
            date-mode="past"
            :model-value="form.id_issued_date"
            @update:model-value="(v: string) => form.id_issued_date = v"
          />
          <UiInput
            label="Nơi cấp"
            :model-value="form.id_issued_place"
            @update:model-value="(v: string) => form.id_issued_place = v"
          />
          <div class="sm:col-span-2">
            <UiInput
              label="Địa chỉ thường trú"
              :model-value="form.permanent_address"
              @update:model-value="(v: string) => form.permanent_address = v"
            />
          </div>
        </div>
      </UiFormSection>

      <UiAlert v-if="message" severity="danger">{{ message }}</UiAlert>
    </div>

    <div v-else-if="stage === 'duplicate'" class="space-y-3">
      <p class="text-sm text-ui-muted">
        Đã có khách với {{ duplicateFieldLabel }} này:
      </p>
      <div v-if="existing" class="rounded-lg border border-ui-border bg-ui-deep/40 p-4">
        <p class="text-sm font-medium text-ui-primary">{{ existing.fullName }}</p>
        <p class="text-xs text-ui-muted">{{ existing.phone }} · {{ existing.code }}</p>
        <p v-if="existingBusy" class="mt-2 text-xs text-status-warning">
          Khách đang ở theo hợp đồng khác
        </p>
      </div>
      <UiButton
        data-test="qc-use-existing"
        :disabled="existingBusy"
        @click="useExisting"
      >
        Dùng khách này
      </UiButton>
    </div>

    <UiAlert v-else-if="stage === 'conflict'" severity="warning">{{ message }}</UiAlert>

    <template #footer>
      <UiButton
        v-if="stage === 'form'"
        data-test="qc-submit"
        :loading="submitting"
        @click="onSubmit"
      >
        Lưu
      </UiButton>
      <UiButton variant="secondary" @click="emit('close')">Đóng</UiButton>
    </template>
  </UiModal>
</template>
