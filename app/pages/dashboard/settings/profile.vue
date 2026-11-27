<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'
import { getApiErrorMessage } from '~/utils/api-error'
import { userAvatarUploadSchema } from '~/utils/validators/users'
import { managedRoleLabel } from '~/utils/users/display'

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Hồ sơ' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const {
  profile,
  status,
  error,
  refresh,
  saving,
  uploadingAvatar,
  fieldErrors,
  updateFullName,
  uploadAvatar,
  removeAvatar,
} = useUserProfile()

const toast = useToast()

// Derived rather than copied in a watcher: watchers do not flush before the server
// render, so SSR emitted an empty input while the client had the name.
const draftName = ref<string | null>(null)
const touched = ref(false)

const fullName = computed({
  get: () => draftName.value ?? profile.value?.fullName ?? '',
  set: (value: string) => { draftName.value = value },
})

watch(profile, () => { draftName.value = null })

const dirty = computed(() => (
  profile.value !== null && fullName.value.trim() !== (profile.value.fullName ?? '')
))
const nameError = computed(() => (touched.value ? fieldErrors.value.full_name?.[0] : undefined))

const roleLabel = computed(() => managedRoleLabel(profile.value?.role ?? null))

async function onSaveName() {
  touched.value = true
  const ok = await updateFullName(fullName.value.trim())
  if (ok) toast.success('Đã cập nhật hồ sơ.')
}

async function onAvatarSelect(file: File) {
  const ok = await uploadAvatar(file)
  toast[ok ? 'success' : 'error'](ok ? 'Đã cập nhật ảnh đại diện.' : 'Không thể tải ảnh lên.')
}

const removingAvatar = ref(false)
const avatarBusy = computed(() => uploadingAvatar.value || removingAvatar.value)

async function onAvatarRemove() {
  removingAvatar.value = true
  let ok = false
  try {
    ok = await removeAvatar()
  }
  finally {
    removingAvatar.value = false
  }
  if (ok) toast.success('Đã xoá ảnh đại diện.')
  else toast.error('Không thể xoá ảnh đại diện.')
}

const avatarDropZone = ref<HTMLElement | null>(null)

function acceptAvatar(file: File | undefined) {
  if (!file || avatarBusy.value) return
  if (!userAvatarUploadSchema.safeParse({ mimeType: file.type, size: file.size }).success) {
    toast.error('Ảnh phải là JPEG, PNG hoặc WebP và không quá 2 MB.')
    return
  }
  void onAvatarSelect(file)
}

const { open: openAvatarDialog, onChange: onAvatarDialogChange, reset: resetAvatarDialog } = useFileDialog({
  multiple: false,
  accept: 'image/jpeg,image/png,image/webp',
})
onAvatarDialogChange((files) => {
  acceptAvatar(files?.[0])
  resetAvatarDialog()
})
const { isOverDropZone } = useDropZone(avatarDropZone, { onDrop: files => acceptAvatar(files?.[0]) })
</script>

<template>
  <div class="w-full max-w-2xl space-y-6">
    <UiPageHeader
      title="Hồ sơ"
      description="Tên và ảnh đại diện hiển thị trong toàn hệ thống."
      back-to="/dashboard/settings"
      back-mobile-only
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiSkeleton v-if="status === 'pending'" class="h-72" />

    <UiAlert v-else-if="error || !profile" severity="danger" title="Không thể tải hồ sơ">
      <p>{{ getApiErrorMessage(error, 'Hãy tải lại trang và thử lại.') }}</p>
      <UiButton class="mt-2" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <template v-else>
      <section
        ref="avatarDropZone"
        aria-labelledby="avatar-heading"
        class="flex flex-wrap items-center gap-4 rounded-lg border p-4 transition-colors"
        :class="isOverDropZone && !avatarBusy ? 'border-ui-accent/60 bg-ui-accent/5' : 'border-ui-border bg-ui-surface'"
      >
        <img
          v-if="profile.avatarUrl"
          :src="profile.avatarUrl"
          alt="Ảnh đại diện hiện tại"
          class="h-14 w-14 shrink-0 rounded-full object-cover"
        >
        <span
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ui-accent/20 text-lg font-semibold text-ui-accent"
          aria-hidden="true"
        >
          {{ (profile.fullName ?? profile.email ?? 'U').charAt(0).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1 basis-40">
          <h2 id="avatar-heading" class="text-sm font-medium text-ui-primary">Ảnh đại diện</h2>
          <p class="text-xs text-ui-muted">JPEG, PNG hoặc WebP, tối đa 2 MB. Có thể kéo thả ảnh vào đây.</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <UiButton class="min-h-11 sm:min-h-0" size="sm" variant="secondary" :loading="uploadingAvatar" :disabled="removingAvatar" @click="openAvatarDialog()">
            {{ profile.hasCustomAvatar ? 'Đổi ảnh' : 'Tải ảnh lên' }}
          </UiButton>
          <UiButton v-if="profile.hasCustomAvatar" class="min-h-11 sm:min-h-0" size="sm" variant="ghost" :disabled="avatarBusy" @click="onAvatarRemove">
            Xoá ảnh
          </UiButton>
        </div>
      </section>

      <UiSurfacePanel class="space-y-4">
        <UiSection title="Thông tin cá nhân">
          <form class="space-y-4" @submit.prevent="onSaveName">
            <UiInput
              v-model="fullName"
              label="Tên hiển thị"
              required
              :error="nameError"
              @blur="touched = true"
            />
            <UiDefinitionList>
              <UiDefinitionItem label="Email" :value="profile.email" />
              <UiDefinitionItem label="Vai trò" :value="roleLabel" />
            </UiDefinitionList>
            <UiButton type="submit" :loading="saving" :disabled="!dirty">
              Lưu thay đổi
            </UiButton>
          </form>
        </UiSection>
      </UiSurfacePanel>
    </template>
  </div>
</template>
