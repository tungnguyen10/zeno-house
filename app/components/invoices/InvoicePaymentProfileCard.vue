<script setup lang="ts">
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'

defineProps<{ profile: InvoiceProfileDisplay | null }>()
</script>

<template>
  <div
    v-if="profile"
    class="grid min-w-0 gap-4 rounded-xl border border-dark-border bg-dark-deep/40 p-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
  >
    <div class="min-w-0">
      <div class="flex min-w-0 items-center gap-3 border-b border-dark-border pb-3">
        <img
          v-if="profile.logoImageUrl"
          :src="profile.logoImageUrl"
          alt="Logo tòa nhà trên hóa đơn"
          class="h-9 w-16 shrink-0 object-contain object-left"
        >
        <IconLogo v-else class="h-8 w-auto max-w-16 shrink-0 text-white" aria-label="Zeno House" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white">Thông tin chuyển khoản khi phát hành</p>
          <p class="mt-0.5 text-xs text-muted">Snapshot này không đổi khi cấu hình tòa nhà được cập nhật.</p>
        </div>
      </div>

      <dl class="mt-3 grid min-w-0 gap-x-4 gap-y-2 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <dt class="text-muted">Chủ tài khoản</dt>
        <dd class="min-w-0 break-words font-medium text-white">{{ profile.accountHolder }}</dd>
        <dt class="text-muted">Số tài khoản</dt>
        <dd class="min-w-0 break-all font-mono font-medium text-white">{{ profile.accountNumber }}</dd>
        <dt class="text-muted">Ngân hàng</dt>
        <dd class="min-w-0 break-words text-white">{{ profile.bankName }}</dd>
        <dt class="text-muted">Nội dung</dt>
        <dd class="min-w-0 break-all rounded-md bg-dark px-2 py-1 font-mono text-xs text-cyan">{{ profile.transferContent }}</dd>
      </dl>
    </div>

    <figure class="mx-auto w-28 sm:mx-0">
      <img
        :src="profile.qrImageUrl"
        alt="Mã QR chuyển khoản ngân hàng"
        class="aspect-square w-28 rounded-lg bg-white object-contain p-1"
      >
      <figcaption class="mt-1.5 text-center text-[11px] text-muted">Quét để thanh toán</figcaption>
    </figure>
  </div>

  <div v-else class="rounded-xl border border-dashed border-dark-border bg-dark-deep/30 px-4 py-5">
    <p class="text-sm font-medium text-white">Hóa đơn này chưa lưu thông tin thanh toán</p>
    <p class="mt-1 text-xs leading-relaxed text-muted">
      Liên hệ quản lý để nhận thông tin chuyển khoản. Hệ thống không dùng cấu hình hiện tại để thay thế snapshot lịch sử.
    </p>
  </div>
</template>
