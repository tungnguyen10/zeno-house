<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { roomFormToApiPayload, type RoomFormData } from '~/components/rooms/RoomForm.vue'

definePageMeta({ title: 'Thêm phòng mới' })

const formData = ref<RoomFormData>({
  building_id: '',
  room_number: '',
  floor: 1,
  status: 'available',
  monthly_rent: 0,
  area: '',
  description: '',
})

const initialSnapshot = ref<RoomFormData>({ ...formData.value })
const draftDismissed = ref(false)
const skipDirtyGuard = ref(false)

const {
  isLoading,
  errors,
  apiError,
  submitCreate,
  hasDraft,
  draftSavedAt,
  restoreDraft,
  clearDraft,
  isDirty,
} = useRoomForm<RoomFormData>({
  draftKey: { mode: 'create', buildingId: computed(() => formData.value.building_id || null) },
  formData,
  initialSnapshot,
})

const showDraft = computed(() => hasDraft.value && !draftDismissed.value)

async function onSubmit(data: RoomFormData) {
  skipDirtyGuard.value = true
  await submitCreate(roomFormToApiPayload(data))
  skipDirtyGuard.value = false
}

function onRestoreDraft() {
  restoreDraft()
  draftDismissed.value = true
}

function onDismissDraft() {
  draftDismissed.value = true
}

function onClearDraft() {
  clearDraft()
  draftDismissed.value = true
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!isDirty.value || skipDirtyGuard.value) return next()
  const ok = typeof window !== 'undefined'
    ? window.confirm('Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')
    : true
  return next(ok)
})

if (import.meta.client) {
  const handler = (event: BeforeUnloadEvent) => {
    if (!isDirty.value || skipDirtyGuard.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', handler)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handler))
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm phòng mới"
      description="Khai báo thông tin phòng. Có thể chỉnh sửa sau khi tạo."
      :back-to="'/rooms'"
      back-label="Danh sách phòng"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <RoomForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        :has-draft="showDraft"
        :draft-saved-at="draftSavedAt"
        :is-dirty="isDirty"
        submit-label="Tạo phòng"
        @submit="onSubmit"
        @cancel="navigateTo('/rooms')"
        @restore-draft="onRestoreDraft"
        @dismiss-draft="onDismissDraft"
        @clear-draft="onClearDraft"
      />
    </div>
  </div>
</template>
