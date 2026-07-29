<script setup lang="ts">
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'
import { usePortalToast } from '~/composables/tenant-portal/usePortalToast'
import { formatCurrencyNumber } from '~/utils/format/currency'

defineProps<{
  profile: InvoiceProfileDisplay | null
  amount: number
  mode: 'outstanding' | 'history'
}>()

const toast = usePortalToast()
type CopyField = 'account' | 'content'
const copying = ref<CopyField | null>(null)
const copied = ref<CopyField | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyValue(field: CopyField, value: string, successMessage: string) {
  if (copying.value) return
  copying.value = field
  copied.value = null
  try {
    await navigator.clipboard.writeText(value)
    copied.value = field
    toast.success(successMessage)
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = null
    }, 2000)
  } catch {
    toast.error('Không thể sao chép. Hãy nhấn giữ để sao chép thủ công.')
  } finally {
    copying.value = null
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <PortalCard v-if="profile">
    <div class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="portal-type-heading text-title">
          {{ mode === 'outstanding' ? 'Thanh toán chuyển khoản' : 'Thông tin chuyển khoản khi phát hành' }}
        </h2>
        <p class="portal-type-caption mt-1 text-body">
          {{ mode === 'outstanding'
            ? 'Dùng đúng nội dung bên dưới để quản lý đối soát nhanh hơn.'
            : 'Thông tin được lưu cùng hoá đơn và không thay đổi theo cấu hình hiện tại.' }}
        </p>
      </div>
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme"
        aria-hidden="true"
      >
        <IconReceipt class="size-5" />
      </span>
    </div>

    <div
      v-if="mode === 'outstanding'"
      class="mt-4 border-y border-border-light py-3"
    >
      <p class="portal-type-caption text-body">Số tiền cần chuyển</p>
      <p class="portal-money portal-type-display mt-0.5 text-title">
        <span>{{ formatCurrencyNumber(amount) }}</span><span class="portal-money-unit">₫</span>
      </p>
    </div>

    <div
      class="mt-4 grid min-w-0 gap-4"
      :class="mode === 'outstanding' ? 'sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start' : ''"
    >
      <dl class="min-w-0 divide-y divide-border-light">
        <div class="grid min-w-0 gap-1 py-2.5 first:pt-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
          <dt class="portal-type-caption text-body">Ngân hàng</dt>
          <dd class="portal-type-body min-w-0 break-words font-medium text-title">{{ profile.bankName }}</dd>
        </div>
        <div class="grid min-w-0 gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
          <dt class="portal-type-caption text-body">Chủ tài khoản</dt>
          <dd class="portal-type-body min-w-0 break-words font-medium text-title">{{ profile.accountHolder }}</dd>
        </div>
        <div class="grid min-w-0 gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
          <dt class="portal-type-caption text-body">Số tài khoản</dt>
          <dd class="flex min-w-0 items-center justify-between gap-2">
            <span class="portal-money min-w-0 break-all text-sm font-semibold text-title">
              {{ profile.accountNumber }}
            </span>
            <PortalButton
              v-if="mode === 'outstanding'"
              variant="ghost"
              size="md"
              icon-only
              aria-label="Sao chép số tài khoản"
              class="shrink-0"
              :loading="copying === 'account'"
              @click="copyValue('account', profile.accountNumber, 'Đã sao chép số tài khoản')"
            >
              <IconCheckSmall v-if="copied === 'account'" class="size-4" aria-hidden="true" />
              <IconCopy v-else-if="copying !== 'account'" class="size-4" aria-hidden="true" />
            </PortalButton>
          </dd>
        </div>
        <div class="grid min-w-0 gap-1 py-2.5 last:pb-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
          <dt class="portal-type-caption text-body">Nội dung</dt>
          <dd class="flex min-w-0 items-center justify-between gap-2">
            <span class="min-w-0 break-all rounded-lg bg-smoke-blue px-2.5 py-2 font-mono text-xs font-semibold text-theme">
              {{ profile.transferContent }}
            </span>
            <PortalButton
              v-if="mode === 'outstanding'"
              variant="ghost"
              size="md"
              icon-only
              aria-label="Sao chép nội dung chuyển khoản"
              class="shrink-0"
              :loading="copying === 'content'"
              @click="copyValue('content', profile.transferContent, 'Đã sao chép nội dung chuyển khoản')"
            >
              <IconCheckSmall v-if="copied === 'content'" class="size-4" aria-hidden="true" />
              <IconCopy v-else-if="copying !== 'content'" class="size-4" aria-hidden="true" />
            </PortalButton>
          </dd>
        </div>
      </dl>

      <figure v-if="mode === 'outstanding'" class="mx-auto w-36">
        <img
          v-if="profile.qrImageUrl"
          :src="profile.qrImageUrl"
          alt="Mã QR chuyển khoản"
          width="144"
          height="144"
          class="aspect-square w-36 rounded-xl border border-border-light bg-white object-contain p-1.5"
        >
        <div
          v-else
          class="flex aspect-square w-36 items-center justify-center rounded-xl border border-dashed border-border-light bg-smoke-card px-4 text-center portal-type-caption text-body"
        >
          QR chưa khả dụng
        </div>
        <figcaption class="portal-type-caption mt-1.5 text-center text-body">
          {{ profile.qrImageUrl ? 'Quét mã để thanh toán' : 'Dùng thông tin tài khoản' }}
        </figcaption>
      </figure>
    </div>
  </PortalCard>

  <PortalCard v-else>
    <div class="flex items-start gap-3">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
        <IconAlertCircle class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <h2 class="portal-type-heading text-title">Chưa có thông tin chuyển khoản</h2>
        <p class="portal-type-caption mt-1 leading-relaxed text-body">
          Liên hệ quản lý để nhận thông tin thanh toán. Hệ thống không dùng cấu hình hiện tại để thay thế dữ liệu lịch sử của hoá đơn.
        </p>
      </div>
    </div>
  </PortalCard>
</template>
