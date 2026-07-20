<script setup lang="ts">
import type { Ref } from 'vue'
import type {
  BuildingInvoiceProfile,
  BuildingInvoiceProfileSaveInput,
} from '~/types/building-invoice-profile'

const props = defineProps<{
  profile: BuildingInvoiceProfile | null
  canEdit: boolean
  loading: boolean
  saving: boolean
  error: string | null
}>()

const emit = defineEmits<{
  save: [intent: BuildingInvoiceProfileSaveInput]
}>()

const defaultTemplate = '{building_code}-{room_number}-{invoice_code}-{period}'
const form = reactive({
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  transferContentTemplate: defaultTemplate,
})
const qrImage = ref<File | null>(null)
const logoImage = ref<File | null>(null)
const removeLogo = ref(false)
const localError = ref<string | null>(null)
const qrObjectUrl = ref<string | null>(null)
const logoObjectUrl = ref<string | null>(null)

const qrPreview = computed(() => qrObjectUrl.value ?? props.profile?.qrImageUrl ?? null)
const logoPreview = computed(() => {
  if (removeLogo.value) return null
  return logoObjectUrl.value ?? props.profile?.logoImageUrl ?? null
})
const isComplete = computed(() => Boolean(props.profile))

watch(() => props.profile, (profile) => {
  form.bankName = profile?.bankName ?? ''
  form.accountHolder = profile?.accountHolder ?? ''
  form.accountNumber = profile?.accountNumber ?? ''
  form.transferContentTemplate = profile?.transferContentTemplate ?? defaultTemplate
  qrImage.value = null
  logoImage.value = null
  removeLogo.value = false
  localError.value = null
}, { immediate: true })

function replaceObjectUrl(target: Ref<string | null>, file: File | null) {
  if (target.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(target.value)
  target.value = file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
}

function selectImage(kind: 'qr' | 'logo', event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (kind === 'qr') {
    qrImage.value = file
    replaceObjectUrl(qrObjectUrl, file)
  }
  else {
    logoImage.value = file
    removeLogo.value = false
    replaceObjectUrl(logoObjectUrl, file)
  }
  localError.value = null
}

function resetLogo() {
  logoImage.value = null
  replaceObjectUrl(logoObjectUrl, null)
  removeLogo.value = true
}

function submit() {
  const bankName = form.bankName.trim()
  const accountHolder = form.accountHolder.trim()
  const accountNumber = form.accountNumber.trim()
  const transferContentTemplate = form.transferContentTemplate.trim()
  if (!bankName || !accountHolder || !accountNumber || !transferContentTemplate) {
    localError.value = 'Điền đủ ngân hàng, chủ tài khoản, số tài khoản và nội dung chuyển khoản.'
    return
  }
  if (!props.profile && !qrImage.value) {
    localError.value = 'Tải ảnh QR ngân hàng để hoàn tất cấu hình lần đầu.'
    return
  }
  emit('save', {
    bankName,
    accountHolder,
    accountNumber,
    transferContentTemplate,
    qrImage: qrImage.value,
    logoImage: logoImage.value,
    removeLogo: removeLogo.value,
  })
}

onBeforeUnmount(() => {
  if (qrObjectUrl.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(qrObjectUrl.value)
  if (logoObjectUrl.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(logoObjectUrl.value)
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="grid gap-3 sm:grid-cols-2">
      <UiSkeleton v-for="index in 4" :key="index" class="h-20 rounded-lg" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-2 border-b border-dark-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-medium text-white">
            {{ isComplete ? 'Đã cấu hình thông tin nhận tiền' : 'Chưa cấu hình thông tin nhận tiền' }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            Thông tin được chụp lại khi phát hành hóa đơn. Thay đổi sau này không sửa hóa đơn cũ.
          </p>
        </div>
        <UiBadge :variant="isComplete ? 'success' : 'warning'" class="shrink-0">
          {{ isComplete ? 'Sẵn sàng' : 'Cần QR ngân hàng' }}
        </UiBadge>
      </div>

      <UiAlert v-if="error || localError" severity="danger">
        {{ localError ?? error }}
      </UiAlert>
      <UiAlert v-if="!canEdit" severity="info">
        Chỉ chủ nhà và admin có thể cập nhật. Manager đang xem bản cấu hình hiện hành.
      </UiAlert>

      <div class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="grid min-w-0 gap-3 sm:grid-cols-2">
          <UiInput
            v-model="form.bankName"
            label="Ngân hàng"
            placeholder="Ví dụ: Ngân hàng Quốc tế Việt Nam (VIB)"
            :readonly="!canEdit"
            required
          />
          <UiInput
            v-model="form.accountHolder"
            label="Chủ tài khoản"
            placeholder="NGUYỄN TUẤN ANH"
            :readonly="!canEdit"
            required
          />
          <UiInput
            v-model="form.accountNumber"
            label="Số tài khoản"
            placeholder="375675817"
            inputmode="numeric"
            :readonly="!canEdit"
            required
          />
          <div class="sm:col-span-2">
            <UiTextarea
              v-model="form.transferContentTemplate"
              label="Mẫu nội dung chuyển khoản"
              :rows="2"
              :readonly="!canEdit"
              required
            />
            <div class="mt-2 flex flex-wrap gap-1.5" aria-label="Biến nội dung chuyển khoản được hỗ trợ">
              <code v-for="token in ['{building_code}', '{room_number}', '{invoice_code}', '{period}']" :key="token" class="rounded-md bg-dark px-2 py-1 text-[11px] text-cyan">{{ token }}</code>
            </div>
          </div>
        </div>

        <div class="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div class="rounded-xl border border-dark-border bg-dark-deep/40 p-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium text-white">QR ngân hàng</p>
                <p class="mt-0.5 text-xs text-muted">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
              </div>
              <span class="text-xs text-warning">Bắt buộc</span>
            </div>
            <div class="mt-3 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-dark-border bg-dark p-2">
              <img v-if="qrPreview" data-test="qr-preview" :src="qrPreview" alt="Ảnh QR ngân hàng hiện tại" class="h-28 w-28 rounded-md bg-white object-contain p-1">
              <span v-else class="px-3 text-center text-xs text-muted">Chưa có ảnh QR</span>
            </div>
            <label v-if="canEdit" class="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md border border-dark-border bg-dark-surface px-3 text-sm font-medium text-white transition-colors hover:bg-dark-hover focus-within:ring-2 focus-within:ring-cyan/40 active:bg-dark-deep">
              {{ qrPreview ? 'Thay ảnh QR' : 'Tải ảnh QR' }}
              <input data-kind="qr" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="selectImage('qr', $event)">
            </label>
          </div>

          <div class="rounded-xl border border-dark-border bg-dark-deep/40 p-3">
            <div>
              <p class="text-sm font-medium text-white">Logo trên phiếu</p>
              <p class="mt-0.5 text-xs text-muted">Tùy chọn · mặc định dùng logo Zeno</p>
            </div>
            <div class="mt-3 flex min-h-20 items-center justify-center rounded-lg border border-dashed border-dark-border bg-dark p-2">
              <img v-if="logoPreview" :src="logoPreview" alt="Logo tòa nhà hiện tại" class="h-16 max-w-full object-contain">
              <IconLogo v-else data-test="zeno-logo" class="h-10 w-auto max-w-28 text-white" aria-label="Logo Zeno mặc định" />
            </div>
            <div v-if="canEdit" class="mt-3 grid grid-cols-2 gap-2">
              <label class="inline-flex min-h-10 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-dark-border bg-dark-surface px-3 text-xs font-medium text-white transition-colors hover:bg-dark-hover focus-within:ring-2 focus-within:ring-cyan/40 active:bg-dark-deep">
                Thay logo
                <input data-kind="logo" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="selectImage('logo', $event)">
              </label>
              <UiButton class="whitespace-nowrap" size="sm" variant="ghost" @click="resetLogo">Dùng logo Zeno</UiButton>
            </div>
          </div>
        </div>
      </div>

      <div v-if="canEdit" class="flex justify-end border-t border-dark-border pt-4">
        <UiButton class="whitespace-nowrap" :loading="saving" :disabled="saving" @click="submit">
          Lưu thay đổi
        </UiButton>
      </div>
    </template>
  </div>
</template>
