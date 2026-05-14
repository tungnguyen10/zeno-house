<script setup lang="ts">
import type { AssignInput } from '~/utils/validators/room-assignments'

const props = defineProps<{
  open: boolean
  roomId: string
  loading?: boolean
}>()

const emit = defineEmits<{
  assign: [input: AssignInput]
  cancel: []
}>()

const q = ref<string | undefined>(undefined)
const { data: tenantData } = useFetch('/api/tenants', {
  query: computed(() => ({ q: q.value, limit: 50, unassigned: 'true' })),
  watch: [q],
})
const tenants = computed(() => (tenantData.value as { data?: { id: string; fullName: string; phone: string }[] } | null)?.data ?? [])

const tenantId = ref('')
const startDate = ref(new Date().toISOString().slice(0, 10))
const notes = ref('')
const tenantError = ref('')
const dateError = ref('')

watch(() => props.open, (val) => {
  if (!val) return
  tenantId.value = ''
  startDate.value = new Date().toISOString().slice(0, 10)
  notes.value = ''
  tenantError.value = ''
  dateError.value = ''
  q.value = undefined
})

function validate(): boolean {
  tenantError.value = ''
  dateError.value = ''
  if (!tenantId.value) {
    tenantError.value = 'Vui lòng chọn khách thuê'
    return false
  }
  if (!startDate.value) {
    dateError.value = 'Vui lòng nhập ngày bắt đầu'
    return false
  }
  return true
}

function submit() {
  if (!validate()) return
  emit('assign', {
    room_id: props.roomId,
    tenant_id: tenantId.value,
    start_date: startDate.value,
    notes: notes.value || null,
  })
}
</script>

<template>
  <UiModal :open="open" title="Giao phòng" @close="emit('cancel')">
    <div class="space-y-4">
      <!-- Tenant search + select -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-muted">
          Khách thuê <span class="text-error ml-0.5" aria-hidden="true">*</span>
        </label>
        <input
          v-model="q"
          type="text"
          placeholder="Tìm theo tên hoặc số điện thoại..."
          class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm"
        >
        <select
          v-model="tenantId"
          class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm"
          :class="tenantError ? 'border-error/50' : ''"
          size="4"
        >
          <option v-for="t in tenants" :key="t.id" :value="t.id">
            {{ t.fullName }} — {{ t.phone }}
          </option>
        </select>
        <p v-if="tenantError" class="text-xs text-error">{{ tenantError }}</p>
      </div>

      <!-- Start date -->
      <UiInput
        v-model="startDate"
        label="Ngày bắt đầu"
        type="date"
        required
        :error="dateError"
      />

      <!-- Notes -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-muted">Ghi chú</label>
        <textarea
          v-model="notes"
          rows="2"
          placeholder="Ghi chú (không bắt buộc)"
          class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm resize-none"
        />
      </div>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('cancel')">Huỷ</UiButton>
      <UiButton :loading="loading" @click="submit">Giao phòng</UiButton>
    </template>
  </UiModal>
</template>
