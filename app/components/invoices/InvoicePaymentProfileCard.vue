<script setup lang="ts">
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'

defineProps<{ profile: InvoiceProfileDisplay | null }>()

const toast = useToast()

async function copyField(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`Đã sao chép ${label}`)
  }
  catch {
    toast.error(`Không sao chép được ${label}`)
  }
}
</script>

<template>
  <div
    v-if="profile"
    class="min-w-0 rounded-xl border border-ui-border bg-ui-deep/40 p-3 sm:p-4"
  >
    <div class="flex min-w-0 items-center gap-3">
      <img
        v-if="profile.logoImageUrl"
        :src="profile.logoImageUrl"
        alt="Logo tòa nhà trên hóa đơn"
        class="h-9 w-16 shrink-0 object-contain object-left"
      >
      <IconLogo v-else class="h-8 w-auto max-w-16 shrink-0 text-ui-primary" aria-label="Zeno House" />
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ui-primary">Thông tin chuyển khoản khi phát hành</p>
        <p class="mt-0.5 text-xs text-ui-muted">Không đổi khi cấu hình tòa nhà thay đổi.</p>
      </div>
    </div>

    <div class="mt-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-start">
      <dl class="min-w-0 divide-y divide-ui-border text-sm">
        <div class="flex items-baseline justify-between gap-3 py-2">
          <dt class="shrink-0 text-xs text-ui-muted">Chủ tài khoản</dt>
          <dd class="min-w-0 break-words text-right font-medium text-ui-primary">{{ profile.accountHolder }}</dd>
        </div>

        <div class="flex items-baseline justify-between gap-3 py-2">
          <dt class="shrink-0 text-xs text-ui-muted">Số tài khoản</dt>
          <dd class="min-w-0">
            <button
              type="button"
              class="group -my-1 flex min-w-0 items-center gap-1.5 rounded-md py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
              :aria-label="`Sao chép số tài khoản ${profile.accountNumber}`"
              @click="copyField('số tài khoản', profile.accountNumber)"
            >
              <span class="min-w-0 break-all font-mono font-medium text-ui-primary transition-colors group-hover:text-ui-accent">{{ profile.accountNumber }}</span>
              <IconCopy class="size-3.5 shrink-0 text-ui-muted transition-colors group-hover:text-ui-accent" aria-hidden="true" />
            </button>
          </dd>
        </div>

        <div class="flex items-baseline justify-between gap-3 py-2">
          <dt class="shrink-0 text-xs text-ui-muted">Ngân hàng</dt>
          <dd class="min-w-0 break-words text-right text-ui-primary">{{ profile.bankName }}</dd>
        </div>

        <div class="flex items-baseline justify-between gap-3 py-2">
          <dt class="shrink-0 text-xs text-ui-muted">Nội dung</dt>
          <dd class="min-w-0">
            <button
              type="button"
              class="group -my-1 flex min-w-0 items-center gap-1.5 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
              :aria-label="`Sao chép nội dung chuyển khoản ${profile.transferContent}`"
              @click="copyField('nội dung chuyển khoản', profile.transferContent)"
            >
              <span class="min-w-0 break-all rounded-md bg-ui-canvas px-2 py-0.5 font-mono text-xs text-ui-accent">{{ profile.transferContent }}</span>
              <IconCopy class="size-3.5 shrink-0 text-ui-muted transition-colors group-hover:text-ui-accent" aria-hidden="true" />
            </button>
          </dd>
        </div>
      </dl>

      <figure class="mx-auto w-28 sm:mx-0">
        <img
          v-if="profile.qrImageUrl"
          :src="profile.qrImageUrl"
          alt="Mã QR chuyển khoản ngân hàng"
          class="aspect-square w-28 rounded-lg bg-white object-contain p-1"
        >
        <div
          v-else
          class="flex aspect-square w-28 items-center justify-center rounded-lg border border-dashed border-ui-border bg-ui-deep/60 px-3 text-center text-xs leading-relaxed text-ui-muted"
        >
          QR chưa khả dụng
        </div>
        <figcaption class="mt-1.5 text-center text-[11px] text-ui-muted">
          {{ profile.qrImageUrl ? 'Quét để thanh toán' : 'Dùng thông tin tài khoản bên cạnh' }}
        </figcaption>
      </figure>
    </div>
  </div>

  <div v-else class="rounded-xl border border-dashed border-ui-border bg-ui-deep/30 px-4 py-5">
    <p class="text-sm font-medium text-ui-primary">Hóa đơn này chưa lưu thông tin thanh toán</p>
    <p class="mt-1 text-xs leading-relaxed text-ui-muted">
      Liên hệ quản lý để nhận thông tin chuyển khoản. Hệ thống không dùng cấu hình hiện tại để thay thế snapshot lịch sử.
    </p>
  </div>
</template>
