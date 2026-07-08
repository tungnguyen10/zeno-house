<script lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { RoomStatus } from '~/types/rooms'
import { roomCreateSchema, type RoomCreateInput } from '~/utils/validators/rooms'

export interface RoomFormData {
  building_id: string
  room_number: string
  floor: number
  status: RoomStatus
  monthly_rent: number
  area: string
  description: string
}

export function roomFormToApiPayload(data: RoomFormData): RoomCreateInput {
  return {
    building_id: data.building_id,
    room_number: data.room_number.trim(),
    floor: Number(data.floor),
    status: data.status,
    monthly_rent: Number(data.monthly_rent),
    area: data.area === '' ? null : Number(data.area),
    description: data.description.trim() || null,
  }
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: RoomFormData
  loading?: boolean
  errors?: Record<string, string[]>
  submitLabel?: string
  hasDraft?: boolean
  draftSavedAt?: string
  isDirty?: boolean
}>(), {
  loading: false,
  errors: () => ({}),
  submitLabel: 'Lưu',
  hasDraft: false,
  draftSavedAt: '',
  isDirty: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: RoomFormData]
  'submit': [value: RoomFormData]
  'cancel': []
  'restore-draft': []
  'dismiss-draft': []
  'clear-draft': []
}>()

const { data: buildingsData } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildings = computed(() => buildingsData.value?.data ?? [])

const statusOptions = [
  { value: 'available', label: 'Trống' },
  { value: 'occupied', label: 'Đã có người thuê' },
  { value: 'maintenance', label: 'Đang bảo trì' },
  { value: 'archived', label: 'Đã lưu trữ' },
]

const FIELD_IDS: Record<string, string> = {
  building_id: 'rf-building',
  room_number: 'rf-room-number',
  floor: 'rf-floor',
  status: 'rf-status',
  monthly_rent: 'rf-monthly-rent',
  area: 'rf-area',
  description: 'rf-description',
}

const localErrors = ref<Record<string, string>>({})
const touched = ref(new Set<string>())
const submitAttempted = ref(false)

function update<K extends keyof RoomFormData>(field: K, value: RoomFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function markTouched(field: string) {
  if (touched.value.has(field)) return
  touched.value = new Set([...touched.value, field])
}

function runValidation() {
  const result = roomCreateSchema.safeParse(roomFormToApiPayload(props.modelValue))
  if (result.success) {
    localErrors.value = {}
    return
  }

  const next: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (key && !next[key]) next[key] = issue.message
  }
  localErrors.value = next
}

watch(() => props.modelValue, () => {
  if (touched.value.size > 0 || submitAttempted.value) runValidation()
}, { deep: true })

function onBlur(field: string) {
  markTouched(field)
  runValidation()
}

function errorFor(field: string): string | undefined {
  if (!touched.value.has(field) && !submitAttempted.value) return undefined
  return localErrors.value[field] ?? props.errors?.[field]?.[0]
}

const firstInvalidFieldId = computed<string | null>(() => {
  const merged: Record<string, string> = { ...localErrors.value }
  for (const [field, msgs] of Object.entries(props.errors ?? {})) {
    if (msgs?.length && !merged[field]) merged[field] = msgs[0]!
  }

  for (const field of Object.keys(merged)) {
    if (!touched.value.has(field) && !submitAttempted.value) continue
    const id = FIELD_IDS[field]
    if (id) return id
  }
  return null
})

function focusField(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  el?.focus?.()
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}

async function onSubmit() {
  submitAttempted.value = true
  runValidation()
  await nextTick()
  if (firstInvalidFieldId.value) {
    focusField(firstInvalidFieldId.value)
    return
  }
  emit('submit', props.modelValue)
}

const draftLabel = computed(() => {
  if (!props.draftSavedAt) return ''
  const date = new Date(props.draftSavedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN')
})

const canSubmit = computed(() => !props.loading && (props.isDirty || submitAttempted.value))
</script>

<template>
  <form class="space-y-8 pb-28 md:pb-0" novalidate @submit.prevent="onSubmit">
    <UiAlert v-if="hasDraft" severity="info" data-test="draft-banner">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
          <IconCheckCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Có bản nháp chưa lưu<span v-if="draftLabel"> lúc {{ draftLabel }}</span>.
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="emit('restore-draft')">Khôi phục</UiButton>
          <UiButton size="sm" variant="ghost" @click="emit('dismiss-draft')">Bỏ qua</UiButton>
          <UiButton size="sm" variant="ghost" @click="emit('clear-draft')">Xoá bản nháp</UiButton>
        </div>
      </div>
    </UiAlert>

    <section class="space-y-4">
      <header class="border-t border-dark-border pt-4">
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-sm font-semibold text-cyan">1</span>
          <div>
            <h3 class="text-sm font-semibold text-white">Vị trí</h3>
            <p class="mt-0.5 text-xs text-muted">Định danh phòng trong một tòa nhà.</p>
          </div>
        </div>
      </header>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <UiSelect
            id="rf-building"
            :model-value="modelValue.building_id"
            label="Tòa nhà"
            :options="buildings.map(b => ({ value: b.id, label: b.name }))"
            placeholder="-- Chọn tòa nhà --"
            required
            :disabled="loading"
            :error="errorFor('building_id')"
            @update:model-value="update('building_id', String($event ?? ''))"
            @blur="onBlur('building_id')"
          />
        </div>
        <UiInput
          id="rf-floor"
          :model-value="String(modelValue.floor)"
          label="Tầng"
          placeholder="1"
          type="number"
          number-mode="integer"
          required
          :disabled="loading"
          :error="errorFor('floor')"
          @update:model-value="update('floor', Number($event))"
          @blur="onBlur('floor')"
        />
        <UiInput
          id="rf-room-number"
          :model-value="modelValue.room_number"
          label="Số phòng"
          placeholder="Ví dụ: 101, A2"
          required
          :disabled="loading"
          :error="errorFor('room_number')"
          @update:model-value="update('room_number', $event)"
          @blur="onBlur('room_number')"
        />
      </div>
    </section>

    <section class="space-y-4">
      <header class="border-t border-dark-border pt-4">
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-sm font-semibold text-cyan">2</span>
          <div>
            <h3 class="text-sm font-semibold text-white">Trạng thái</h3>
            <p class="mt-0.5 text-xs text-muted">Tình trạng vận hành hiện tại của phòng.</p>
          </div>
        </div>
      </header>
      <UiSelect
        id="rf-status"
        :model-value="modelValue.status"
        label="Trạng thái"
        :options="statusOptions"
        :disabled="loading"
        :error="errorFor('status')"
        @update:model-value="update('status', String($event) as RoomStatus)"
        @blur="onBlur('status')"
      />
    </section>

    <section class="space-y-4">
      <header class="border-t border-dark-border pt-4">
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-sm font-semibold text-cyan">3</span>
          <div>
            <h3 class="text-sm font-semibold text-white">Giá thuê & diện tích</h3>
            <p class="mt-0.5 text-xs text-muted">Giá chuẩn dùng làm mặc định khi tạo hợp đồng mới.</p>
          </div>
        </div>
      </header>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiInput
          id="rf-monthly-rent"
          :model-value="String(modelValue.monthly_rent)"
          label="Giá thuê / tháng"
          placeholder="Ví dụ: 3500000"
          type="number"
          number-mode="currency"
          required
          :disabled="loading"
          :error="errorFor('monthly_rent')"
          @update:model-value="update('monthly_rent', Number($event))"
          @blur="onBlur('monthly_rent')"
        >
          <template #suffix>VND</template>
        </UiInput>

        <UiInput
          id="rf-area"
          :model-value="modelValue.area"
          label="Diện tích"
          placeholder="Ví dụ: 25.5"
          type="number"
          number-mode="area"
          :disabled="loading"
          :error="errorFor('area')"
          @update:model-value="update('area', $event)"
          @blur="onBlur('area')"
        >
          <template #suffix>m²</template>
        </UiInput>
      </div>
    </section>

    <section class="space-y-4">
      <header class="border-t border-dark-border pt-4">
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-sm font-semibold text-cyan">4</span>
          <div>
            <h3 class="text-sm font-semibold text-white">Mô tả</h3>
            <p class="mt-0.5 text-xs text-muted">Ghi chú nội bộ về đặc điểm hoặc lưu ý của phòng.</p>
          </div>
        </div>
      </header>
      <UiTextarea
        id="rf-description"
        :model-value="modelValue.description"
        label="Mô tả"
        placeholder="Mô tả ngắn về phòng"
        :rows="3"
        :disabled="loading"
        :error="errorFor('description')"
        @update:model-value="update('description', $event)"
        @blur="onBlur('description')"
      />
    </section>

    <div class="hidden items-center justify-end gap-3 border-t border-dark-border pt-2 md:flex">
      <UiButton variant="ghost" type="button" :disabled="loading" @click="emit('cancel')">
        Huỷ
      </UiButton>
      <UiButton type="submit" :loading="loading" :disabled="!canSubmit">
        {{ submitLabel }}
      </UiButton>
    </div>

    <div
      data-test="sticky-save-bar"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-dark-border bg-dark-deep/95 px-4 pt-3 backdrop-blur md:hidden"
      :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }"
    >
      <div class="flex items-center gap-2">
        <UiButton class="flex-1" variant="ghost" type="button" :disabled="loading" @click="emit('cancel')">
          Huỷ
        </UiButton>
        <UiButton class="flex-1" type="submit" :loading="loading" :disabled="!canSubmit" @click="onSubmit">
          {{ submitLabel }}
        </UiButton>
      </div>
    </div>
  </form>
</template>
