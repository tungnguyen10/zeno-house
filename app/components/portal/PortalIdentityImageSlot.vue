<script setup lang="ts">
import { TENANT_DOCUMENT_MAX_BYTES, TENANT_IDENTITY_IMAGE_MIME_TYPES } from '~/utils/validators/tenant-portal'

withDefaults(defineProps<{
  label: string
  signedUrl: string | null
  uploading?: boolean
  progress?: number
}>(), {
  uploading: false,
  progress: 0,
})

const emit = defineEmits<{
  (e: 'select', file: File): void
  (e: 'remove'): void
  (e: 'error', message: string): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function pick() {
  inputRef.value?.click()
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  // Validate type/size before upload so errors surface immediately (D5/D10).
  if (!TENANT_IDENTITY_IMAGE_MIME_TYPES.includes(file.type as (typeof TENANT_IDENTITY_IMAGE_MIME_TYPES)[number])) {
    emit('error', 'Ảnh định danh phải là JPEG, PNG hoặc WebP.')
    return
  }
  if (file.size > TENANT_DOCUMENT_MAX_BYTES) {
    emit('error', 'Ảnh định danh không được vượt quá 5MB.')
    return
  }
  emit('select', file)
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-title">{{ label }}</p>
    <div class="relative aspect-[3/2] overflow-hidden rounded-2xl border border-border-light bg-smoke">
      <img
        v-if="signedUrl"
        :src="signedUrl"
        :alt="label"
        class="h-full w-full object-cover"
      >
      <button
        v-else
        type="button"
        class="flex h-full w-full flex-col items-center justify-center gap-2 text-body transition-colors hover:bg-smoke-blue"
        @click="pick"
      >
        <IconPhoto class="h-7 w-7" aria-hidden="true" />
        <span class="text-xs font-medium">Chụp hoặc chọn ảnh</span>
      </button>

      <div
        v-if="uploading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80"
      >
        <IconSpinner class="h-6 w-6 animate-spin text-theme motion-reduce:animate-none" aria-hidden="true" />
        <span class="text-xs font-medium text-title">Đang tải {{ progress }}%</span>
      </div>
    </div>

    <div v-if="signedUrl && !uploading" class="flex gap-2">
      <PortalButton variant="secondary" size="sm" class="flex-1" @click="pick">
        <IconRefresh class="h-4 w-4" aria-hidden="true" />
        Thay ảnh
      </PortalButton>
      <PortalButton variant="ghost" size="sm" @click="emit('remove')">
        <IconTrash class="h-4 w-4" aria-hidden="true" />
        Xóa
      </PortalButton>
    </div>

    <input
      ref="inputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      class="hidden"
      @change="onChange"
    >
  </div>
</template>
