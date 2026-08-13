<script setup lang="ts">
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'

defineProps<{ profile: InvoiceProfileDisplay | null }>()
</script>

<template>
  <div
    v-if="profile"
    class="grid min-w-0 gap-4 rounded-xl border border-ui-border bg-ui-deep/40 p-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
  >
    <div class="min-w-0">
      <div class="flex min-w-0 items-center gap-3 border-b border-ui-border pb-3">
        <img
          v-if="profile.logoImageUrl"
          :src="profile.logoImageUrl"
          alt="Logo tòa nhà trên hóa đơn"
          class="h-9 w-16 shrink-0 object-contain object-left"
        >
        <IconLogo v-else class="h-8 w-auto max-w-16 shrink-0 text-ui-primary" aria-label="Zeno House" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-ui-primary">Thông tin chuyển khoản khi phát hành</p>
          <p class="mt-0.5 text-xs text-ui-muted">Snapshot này không đổi khi cấu hình tòa nhà được cập nhật.</p>
        </div>
      </div>

      <dl class="mt-3 grid min-w-0 gap-x-4 gap-y-2 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <dt class="text-ui-muted">Chủ tài khoản</dt>
        <dd class="min-w-0 break-words font-medium text-ui-primary">{{ profile.accountHolder }}</dd>
        <dt class="text-ui-muted">Số tài khoản</dt>
        <dd class="min-w-0 break-all font-mono font-medium text-ui-primary">{{ profile.accountNumber }}</dd>
        <dt class="text-ui-muted">Ngân hàng</dt>
        <dd class="min-w-0 break-words text-ui-primary">{{ profile.bankName }}</dd>
        <dt class="text-ui-muted">Nội dung</dt>
        <dd class="min-w-0 break-all rounded-md bg-ui-canvas px-2 py-1 font-mono text-xs text-ui-accent">{{ profile.transferContent }}</dd>
      </dl>
    </div>

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

  <div v-else class="rounded-xl border border-dashed border-ui-border bg-ui-deep/30 px-4 py-5">
    <p class="text-sm font-medium text-ui-primary">Hóa đơn này chưa lưu thông tin thanh toán</p>
    <p class="mt-1 text-xs leading-relaxed text-ui-muted">
      Liên hệ quản lý để nhận thông tin chuyển khoản. Hệ thống không dùng cấu hình hiện tại để thay thế snapshot lịch sử.
    </p>
  </div>
</template>
