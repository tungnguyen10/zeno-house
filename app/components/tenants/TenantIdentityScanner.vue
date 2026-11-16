<script setup lang="ts">
import { useTenantIdentityExtract } from '~/composables/tenants/useTenantIdentityExtract'
import {
  buildSuggestionRows,
  type SuggestionField,
  type SuggestionValues,
} from '~/utils/tenant-identity-suggestions'
import type { IdentitySuggestion } from '~/utils/validators/tenant-identity-extraction'

const props = defineProps<{
  currentValues: SuggestionValues
  /** Form fields that can receive a suggestion. */
  fields: SuggestionField[]
}>()

const emit = defineEmits<{ apply: [values: SuggestionValues] }>()

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_FILES = 2
const MAX_BYTES = 5 * 1024 * 1024
const MISMATCH_WARNING = 'Hai ảnh có thông tin không khớp'

const config = useRuntimeConfig()
const auth = useAuthStore()
const visible = computed(() => {
  const flag = config.public.aiTenantVisionEnabled as unknown
  const enabled = flag === true || flag === 'true'
  return enabled && (auth.can('tenants.create') || auth.can('tenants.update'))
})

const { extract, abort, loading, error } = useTenantIdentityExtract()

const items = ref<{ file: File, url: string }[]>([])
const localError = ref<string | null>(null)
const suggestion = ref<IdentitySuggestion | null>(null)
const lastApplied = ref<SuggestionValues>({})
const cameraInput = ref<HTMLInputElement | null>(null)
const pickInput = ref<HTMLInputElement | null>(null)

const rows = computed(() => suggestion.value
  ? buildSuggestionRows(suggestion.value, props.currentValues, lastApplied.value, props.fields)
  : [])
const applicableRows = computed(() => rows.value.filter(row => row.state === 'applicable'))
const mismatch = computed(() => suggestion.value?.identity_mismatch === true)
const warnings = computed(() => (suggestion.value?.warnings ?? []).filter(text => text !== MISMATCH_WARNING))

function revokeAll() {
  for (const item of items.value) URL.revokeObjectURL(item.url)
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files ?? [])
  try {
    input.value = ''
  }
  catch {
    // Some environments forbid resetting file inputs; the selection is already copied.
  }
  localError.value = null
  suggestion.value = null
  for (const file of selected) {
    if (!ACCEPT.split(',').includes(file.type)) {
      localError.value = 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.'
      continue
    }
    if (file.size > MAX_BYTES) {
      localError.value = 'Ảnh quá lớn (tối đa 5 MB mỗi ảnh).'
      continue
    }
    if (items.value.length >= MAX_FILES) {
      localError.value = `Chỉ chọn tối đa ${MAX_FILES} ảnh.`
      break
    }
    items.value = [...items.value, { file, url: URL.createObjectURL(file) }]
  }
}

function removeAt(index: number) {
  const item = items.value[index]
  if (!item) return
  URL.revokeObjectURL(item.url)
  items.value = items.value.filter((_, i) => i !== index)
  suggestion.value = null
  localError.value = null
}

async function onExtract() {
  if (items.value.length === 0 || loading.value) return
  suggestion.value = null
  localError.value = null
  suggestion.value = await extract(items.value.map(item => item.file))
}

function applyRow(field: SuggestionField) {
  const row = rows.value.find(item => item.field === field)
  if (!row || row.state !== 'applicable') return
  lastApplied.value = { ...lastApplied.value, [field]: row.value }
  emit('apply', { [field]: row.value })
}

function applyEmpty() {
  const payload: SuggestionValues = {}
  for (const row of applicableRows.value) payload[row.field] = row.value
  if (Object.keys(payload).length === 0) return
  lastApplied.value = { ...lastApplied.value, ...payload }
  emit('apply', payload)
}

function reset() {
  abort()
  revokeAll()
  items.value = []
  suggestion.value = null
  lastApplied.value = {}
  localError.value = null
}

onBeforeUnmount(() => {
  abort()
  revokeAll()
})

defineExpose({ reset })
</script>

<template>
  <section
    v-if="visible"
    class="space-y-3 rounded-lg border border-ui-border bg-ui-hover/30 p-4"
    data-test="identity-scanner"
  >
    <div>
      <h4 class="text-xs font-semibold text-ui-primary">Đọc thông tin từ ảnh giấy tờ</h4>
      <p class="mt-1 text-xs text-ui-muted">
        Chụp hoặc chọn 1–2 ảnh CCCD, hoặc ảnh chụp màn hình VNeID.
      </p>
      <p class="mt-1 text-xs text-ui-muted" data-test="scanner-notice">
        Ảnh được gửi tới dịch vụ AI để đọc chữ và không được lưu lại. Kiểm tra từng thông tin trước khi áp dụng.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton variant="secondary" size="sm" :disabled="loading" @click="cameraInput?.click()">
        Chụp ảnh
      </UiButton>
      <UiButton variant="secondary" size="sm" :disabled="loading" @click="pickInput?.click()">
        Chọn ảnh
      </UiButton>
      <input
        ref="cameraInput"
        type="file"
        class="sr-only"
        tabindex="-1"
        :accept="ACCEPT"
        capture="environment"
        data-test="scanner-camera-input"
        @change="onFilesSelected"
      >
      <input
        ref="pickInput"
        type="file"
        class="sr-only"
        tabindex="-1"
        :accept="ACCEPT"
        multiple
        data-test="scanner-file-input"
        @change="onFilesSelected"
      >
    </div>

    <ul v-if="items.length" class="flex flex-wrap gap-3">
      <li
        v-for="(item, index) in items"
        :key="item.url"
        class="flex items-center gap-2"
        data-test="scanner-preview"
      >
        <img
          :src="item.url"
          :alt="`Ảnh giấy tờ ${index + 1}`"
          class="h-16 w-24 rounded-md border border-ui-border object-cover"
        >
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="loading"
          :data-test="`scanner-remove-${index}`"
          @click="removeAt(index)"
        >
          Bỏ ảnh
        </UiButton>
      </li>
    </ul>

    <p v-if="localError" class="text-xs text-status-danger" role="alert" data-test="scanner-local-error">
      {{ localError }}
    </p>

    <UiButton
      size="sm"
      data-test="scanner-extract"
      :loading="loading"
      :disabled="items.length === 0"
      @click="onExtract"
    >
      Đọc thông tin
    </UiButton>

    <UiAlert v-if="error" severity="danger" data-test="scanner-error">{{ error }}</UiAlert>

    <template v-if="suggestion">
      <UiAlert v-if="mismatch" severity="danger" data-test="scanner-mismatch">
        Hai ảnh có thông tin không khớp. Thay ảnh hoặc nhập tay.
      </UiAlert>
      <UiAlert v-if="warnings.length" severity="warning" data-test="scanner-warnings">
        <span v-for="warning in warnings" :key="warning" class="block">{{ warning }}</span>
      </UiAlert>

      <p v-if="rows.length === 0 && !mismatch" class="text-xs text-ui-muted">
        Không đọc được thông tin nào từ ảnh. Thử ảnh rõ hơn hoặc nhập tay.
      </p>

      <ul v-if="rows.length" class="divide-y divide-ui-border rounded-md border border-ui-border bg-ui-surface">
        <li
          v-for="row in rows"
          :key="row.field"
          class="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          :data-test="`scanner-row-${row.field}`"
        >
          <div class="min-w-0">
            <p class="text-xs text-ui-muted">{{ row.label }}</p>
            <p class="break-words text-sm font-medium text-ui-primary">{{ row.display }}</p>
            <p v-if="row.state === 'edited'" class="text-xs text-ui-muted">
              Đã sửa tay: {{ row.current }}
            </p>
            <p v-if="row.note" class="text-xs text-status-warning">{{ row.note }}</p>
          </div>
          <p v-if="row.state === 'matches'" class="shrink-0 text-xs text-status-success">Đã khớp</p>
          <UiButton
            v-else-if="row.state !== 'review'"
            variant="secondary"
            size="sm"
            class="shrink-0 self-start sm:self-center"
            :disabled="row.state !== 'applicable'"
            :data-test="`scanner-apply-${row.field}`"
            @click="applyRow(row.field)"
          >
            Áp dụng
          </UiButton>
        </li>
      </ul>

      <UiButton
        v-if="rows.length"
        variant="secondary"
        size="sm"
        data-test="scanner-apply-empty"
        :disabled="applicableRows.length === 0"
        @click="applyEmpty"
      >
        Áp dụng các trường còn trống
      </UiButton>
    </template>
  </section>
</template>
