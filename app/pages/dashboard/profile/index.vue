<script setup lang="ts">
import { getApiErrorMessage } from '~/utils/api-error'

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

const fullName = ref('')
const touched = ref(false)

watch(profile, (value) => {
  if (value) fullName.value = value.fullName ?? ''
}, { immediate: true })

const dirty = computed(() => (
  profile.value !== null && fullName.value.trim() !== (profile.value.fullName ?? '')
))
const nameError = computed(() => (touched.value ? fieldErrors.value.full_name?.[0] : undefined))

const roleLabel = computed(() => {
  const map: Record<string, string> = { admin: 'Admin', owner: 'Owner', manager: 'Manager' }
  const role = profile.value?.role
  return role ? (map[role] ?? role) : ''
})

async function onSaveName() {
  touched.value = true
  const ok = await updateFullName(fullName.value.trim())
  if (ok) toast.success('Đã cập nhật hồ sơ.')
}

async function onAvatarSelect(file: File) {
  const ok = await uploadAvatar(file)
  toast[ok ? 'success' : 'error'](ok ? 'Đã cập nhật ảnh đại diện.' : 'Không thể tải ảnh lên.')
}

async function onAvatarRemove() {
  const ok = await removeAvatar()
  if (ok) toast.success('Đã xóa ảnh đại diện.')
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-6">
    <UiPageHeader
      title="Hồ sơ của tôi"
      description="Cập nhật tên hiển thị và ảnh đại diện dùng trong toàn bộ hệ thống."
    />

    <UiSkeleton v-if="status === 'pending'" class="h-72" />

    <UiAlert v-else-if="error || !profile" severity="danger" title="Không thể tải hồ sơ">
      <p>{{ getApiErrorMessage(error, 'Hãy tải lại trang và thử lại.') }}</p>
      <UiButton class="mt-2" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <template v-else>
      <UiSurfacePanel class="space-y-4">
        <UiSection title="Ảnh đại diện" description="JPEG, PNG hoặc WebP, tối đa 2MB.">
          <UiFileUpload
            variant="image"
            accept="image/jpeg,image/png,image/webp"
            :max-bytes="2 * 1024 * 1024"
            :preview-url="profile.avatarUrl"
            preview-alt="Ảnh đại diện hiện tại"
            pick-label="Tải ảnh lên"
            replace-label="Đổi ảnh"
            :disabled="uploadingAvatar"
            @select="onAvatarSelect"
          >
            <template #empty>
              <span
                class="flex h-16 w-16 items-center justify-center rounded-full bg-cyan/20 text-lg font-semibold text-cyan"
                aria-hidden="true"
              >
                {{ (profile.fullName ?? profile.email ?? 'U').charAt(0).toUpperCase() }}
              </span>
            </template>
          </UiFileUpload>
          <UiButton
            v-if="profile.hasCustomAvatar"
            size="sm"
            variant="ghost"
            :disabled="uploadingAvatar"
            @click="onAvatarRemove"
          >
            Xóa ảnh đại diện
          </UiButton>
        </UiSection>
      </UiSurfacePanel>

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
            <UiInput :model-value="profile.email ?? ''" label="Email" disabled />
            <UiInput :model-value="roleLabel" label="Vai trò" disabled />
            <UiButton type="submit" :loading="saving" :disabled="!dirty">
              Lưu thay đổi
            </UiButton>
          </form>
        </UiSection>
      </UiSurfacePanel>

      <UiSurfacePanel class="space-y-3">
        <UiSection title="Bảo mật" description="Đổi mật khẩu đăng nhập.">
          <UiButton variant="secondary" size="sm" @click="navigateTo('/dashboard/profile/password')">
            Đổi mật khẩu
          </UiButton>
        </UiSection>
      </UiSurfacePanel>
    </template>
  </div>
</template>
