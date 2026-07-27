<script setup lang="ts">
import clsx from 'clsx'
import type { StyleValue } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /**
   * `'image'` — shows a preview area + pick button. Good for QR codes, photos, logos.
   * `'file'`  — shows a compact clickable row with filename. Good for receipts, documents.
   */
  variant?: 'image' | 'file'
  /** HTML accept attribute, e.g. "image/jpeg,image/png,image/webp". */
  accept?: string
  /** Maximum allowed file size in bytes. Defaults to 5 MB. */
  maxBytes?: number
  label?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  /** External error message (e.g. from a failed server upload). */
  error?: string
  /** URL of the currently saved file. Shown in preview (image mode) or changes row state. */
  previewUrl?: string | null
  /** Alt text for the preview <img>. Falls back to label. */
  previewAlt?: string
  /** Extra classes applied to the preview <img> in image mode. E.g. "bg-white p-1" for QR codes. */
  previewImageClass?: string
  /** Display name of the locally selected file (e.g. file.name). Controls the row label. */
  filename?: string | null
  /** Placeholder text when no file is selected (file mode). */
  placeholder?: string
  /** Pick button / row label when no file exists yet. */
  pickLabel?: string
  /** Pick button label when a previewUrl or filename already exists. */
  replaceLabel?: string
}>(), {
  variant: 'file',
  accept: '*',
  maxBytes: 5 * 1024 * 1024,
  required: false,
  disabled: false,
  pickLabel: 'Chọn file',
  replaceLabel: 'Thay file',
})

const emit = defineEmits<{
  /** Emitted after internal type + size validation passes. */
  select: [file: File]
  /** Emitted when the file fails internal validation (wrong type or too large). */
  'validation-error': [message: string]
}>()

const attrs = useAttrs()
const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style as StyleValue | undefined)

const dropZoneRef = ref<HTMLElement | null>(null)
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop(files) {
    if (props.disabled) return
    const file = files?.[0]
    if (file) validateAndEmit(file)
  },
})

const { open: openDialog, onChange: onDialogChange, reset: resetDialog } = useFileDialog({ multiple: false })
onDialogChange((files) => {
  const file = files?.[0]
  resetDialog()
  if (!file) return
  validateAndEmit(file)
})

const fieldId = useId()
const labelId = `${fieldId}-label`
const errorId = `${fieldId}-error`

const hasExisting = computed(() => !!(props.previewUrl || props.filename))

// Cache the parsed accept list so it's not re-split/trimmed on every file event.
const acceptedTypes = computed(() => {
  if (!props.accept || props.accept === '*') return []
  return props.accept.split(',').map(s => s.trim()).filter(Boolean)
})

// Cache the file-row border/bg class so it's not re-computed on every render.
const fileRowClass = computed(() =>
  clsx(
    props.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-dark-hover',
    isOverDropZone.value
      ? 'border-cyan/70 bg-cyan/5'
      : props.error ? 'border-error/60' : 'border-dark-border',
  ),
)

function pick() {
  if (!props.disabled) openDialog({ accept: props.accept !== '*' ? props.accept : undefined })
}

function validateAndEmit(file: File) {
  if (acceptedTypes.value.length > 0 && !acceptedTypes.value.includes(file.type)) {
    emit('validation-error', 'Định dạng file không được hỗ trợ.')
    return
  }
  const limit = props.maxBytes ?? 5 * 1024 * 1024
  if (file.size > limit) {
    const mb = Math.round(limit / 1024 / 1024)
    emit('validation-error', `File không được vượt quá ${mb} MB.`)
    return
  }
  emit('select', file)
}
</script>

<template>
  <div class="flex flex-col gap-1.5" :class="rootClass" :style="rootStyle">
    <p
      v-if="label"
      :id="labelId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="ml-0.5 text-error" aria-hidden="true">*</span>
    </p>

    <!-- ── Image variant ─────────────────────────────────── -->
    <template v-if="variant === 'image'">
      <div
        ref="dropZoneRef"
        class="relative flex min-h-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-dark p-2 transition-colors"
        :class="isOverDropZone ? 'border-cyan/60 bg-cyan/5' : 'border-dark-border'"
        @click="pick"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          :alt="previewAlt ?? label ?? 'Ảnh xem trước'"
          :class="['max-h-24 max-w-full rounded object-contain', previewImageClass]"
        >
        <div v-else class="flex flex-col items-center gap-1.5 text-center">
          <slot name="empty">
            <IconPhoto class="h-6 w-6 text-muted" aria-hidden="true" />
            <span class="text-xs text-muted">Kéo thả hoặc nhấn để chọn</span>
          </slot>
        </div>

        <div
          v-if="isOverDropZone"
          class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-cyan/10 ring-2 ring-inset ring-cyan/40"
          aria-hidden="true"
        >
          <IconPhoto class="h-8 w-8 text-cyan" />
          <span class="text-xs font-medium text-cyan">Thả để tải lên</span>
        </div>
      </div>

      <UiButton
        type="button"
        variant="secondary"
        size="sm"
        :disabled="disabled"
        class="w-full"
        :aria-labelledby="label ? labelId : undefined"
        @click="pick"
      >
        {{ hasExisting ? replaceLabel : pickLabel }}
      </UiButton>
    </template>

    <!-- ── File variant ──────────────────────────────────── -->
    <div
      v-else
      ref="dropZoneRef"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-labelledby="label ? labelId : undefined"
      :aria-describedby="error ? errorId : undefined"
      :aria-invalid="error ? 'true' : undefined"
      :aria-disabled="disabled"
      class="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-md border bg-dark-surface px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-cyan/40"
      :class="fileRowClass"
      @click="pick"
      @keydown.enter.prevent="pick"
      @keydown.space.prevent="pick"
    >
      <slot name="icon">
        <IconDocumentText class="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </slot>
      <span
        class="min-w-0 flex-1 truncate"
        :class="filename ? 'text-white' : 'text-muted'"
      >
        {{ filename ?? (previewUrl ? 'Đã có file' : (placeholder ?? 'Chọn file...')) }}
      </span>
    </div>

    <p v-if="hint && !error" class="text-xs text-muted">{{ hint }}</p>
    <p v-if="error" :id="errorId" role="alert" class="text-xs text-error">{{ error }}</p>
  </div>
</template>
