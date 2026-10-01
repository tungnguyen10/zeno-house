<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'
import { contractPath } from '~/utils/routes/operational'

definePageMeta({ title: 'In biên bản quyết toán', layout: false })
const route = useRoute()
const identifier = String(route.params.code)
const { contract, isLoading: contractLoading, error: contractError } = useContractDetail(identifier)
const { bundle, isLoading, error, refresh } = useContractCheckout(identifier)
const statement = computed(() => bundle.value?.statement)
const breakdown = computed(() => statement.value?.preview)
const returnPath = computed(() => `${contractPath(contract.value ?? { id: identifier })}#checkout`)
const statusLabel = computed(() => ({ unsettled: 'Chưa quyết toán', awaiting_payment: 'Còn phải thu', awaiting_refund: 'Còn phải hoàn', settled: 'Đã tất toán' }[statement.value?.financialStatus ?? 'unsettled']))
function printStatement() { if (statement.value && !isLoading.value && !contractLoading.value) window.print() }
</script>

<template>
  <div class="settlement-print min-h-screen bg-ui-canvas px-3 py-4 text-ui-primary sm:px-6">
    <header class="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3">
      <NuxtLink :to="returnPath" class="text-sm text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40">Về hợp đồng</NuxtLink>
      <UiButton size="sm" :disabled="isLoading || contractLoading || !statement" @click="printStatement">In / lưu PDF</UiButton>
    </header>
    <div v-if="isLoading || contractLoading" class="mx-auto max-w-3xl space-y-3"><UiSkeleton class="h-8 w-64" /><UiSkeleton class="h-64 w-full" /></div>
    <UiAlert v-else-if="error || contractError" severity="danger" class="no-print mx-auto max-w-3xl">{{ error || 'Không thể tải hợp đồng' }}<UiButton size="sm" variant="secondary" class="ml-2" @click="refresh">Thử lại</UiButton></UiAlert>
    <UiAlert v-else-if="!statement || !breakdown" severity="warning" class="no-print mx-auto max-w-3xl">Chưa có biên bản đã xác nhận. Về hợp đồng để hoàn thành quyết toán.</UiAlert>
    <UiSurfacePanel v-else-if="contract" as="article" class="statement-sheet mx-auto max-w-3xl space-y-6">
      <header class="space-y-1 border-b border-ui-border pb-4">
        <h1 class="text-xl font-semibold">Biên bản quyết toán trả phòng</h1>
        <p class="break-words text-sm">{{ statement.code }} · {{ contract.contractCode }}</p>
        <p class="text-xs text-ui-muted">Xác nhận lúc {{ new Date(statement.confirmedAt).toLocaleString('vi-VN') }}</p>
      </header>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-xs text-ui-muted">Khách thuê</dt><dd class="mt-1">{{ contract.tenant.fullName }}</dd></div>
        <div><dt class="text-xs text-ui-muted">Phòng / toà nhà</dt><dd class="mt-1">{{ contract.room.roomNumber }} · {{ contract.room.buildingName }}</dd></div>
        <div><dt class="text-xs text-ui-muted">Ngày trả thực tế</dt><dd class="mt-1">{{ bundle?.checkout?.actualReturnDate }}</dd></div>
        <div><dt class="text-xs text-ui-muted">Lý do</dt><dd class="mt-1 break-words">{{ bundle?.checkout?.reason }}</dd></div>
      </dl>
      <section class="space-y-3">
        <h2 class="text-sm font-semibold">Số liệu tại thời điểm xác nhận</h2>
        <dl class="space-y-2 text-sm">
          <div
v-for="row in [
            ['Cọc đang giữ', breakdown.depositHeld], ['Tiền bù trừ đã duyệt', breakdown.creditHeld],
            ['Nợ hoá đơn', breakdown.existingDebt], ['Điện, nước và phí cuối', breakdown.finalChargesTotal],
            ['Tổng phải trả', breakdown.totalDue], ['Cọc đã bù trừ', breakdown.depositApplied],
            ['Tiền đã duyệt đã bù trừ', breakdown.creditApplied], ['Phải hoàn theo biên bản', breakdown.refundDue],
            ['Phải thu thêm theo biên bản', breakdown.additionalDue],
          ]" :key="String(row[0])" class="flex justify-between gap-4"><dt class="text-ui-muted">{{ row[0] }}</dt><dd class="shrink-0 tabular-nums">{{ formatCurrency(Number(row[1])) }}</dd></div>
        </dl>
        <ul v-if="breakdown.charges.length" class="divide-y divide-ui-border border-t border-ui-border text-sm">
          <li v-for="charge in breakdown.charges" :key="charge.key" class="flex justify-between gap-4 py-2"><span>{{ charge.label }} · {{ charge.quantity }} × {{ formatCurrency(charge.unitPrice) }}</span><span class="shrink-0 tabular-nums">{{ formatCurrency(charge.amount) }}</span></li>
        </ul>
        <ul v-if="breakdown.invoices.length" class="space-y-2 text-sm">
          <li v-for="invoice in breakdown.invoices" :key="invoice.id" class="flex justify-between gap-4"><span>Hoá đơn {{ invoice.code || invoice.id }} · hạn {{ invoice.dueDate }}</span><span class="shrink-0 tabular-nums">{{ formatCurrency(invoice.balance) }}</span></li>
        </ul>
      </section>
      <section class="space-y-3 border-t border-ui-border pt-4">
        <h2 class="text-sm font-semibold">Tình trạng thu / hoàn hiện tại · {{ statusLabel }}</h2>
        <p class="text-xs text-ui-muted">Thông tin cập nhật khi mở bản in; số liệu quyết toán phía trên được giữ nguyên.</p>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between gap-4"><dt>Đã hoàn</dt><dd class="tabular-nums">{{ formatCurrency(statement.refundedAmount) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Còn phải hoàn</dt><dd class="tabular-nums">{{ formatCurrency(statement.remainingRefund) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Còn phải thu</dt><dd class="tabular-nums">{{ formatCurrency(statement.outstandingDebt) }}</dd></div>
        </dl>
        <ul class="space-y-2 text-sm"><li v-for="refund in bundle?.refunds" :key="refund.id">{{ refund.paidAt }} · {{ refund.paymentMethod }} · {{ formatCurrency(refund.amount) }}<span v-if="refund.note"> · {{ refund.note }}</span></li></ul>
      </section>
      <footer class="grid grid-cols-2 gap-4 border-t border-ui-border pt-4 text-center text-sm"><p>Đại diện quản lý<br><span class="text-xs text-ui-muted">Ký và ghi rõ họ tên</span></p><p>Khách thuê<br><span class="text-xs text-ui-muted">Ký và ghi rõ họ tên</span></p></footer>
    </UiSurfacePanel>
  </div>
</template>

<style scoped>
@media print {
  @page { size: A4; margin: 14mm; }
  .no-print { display: none !important; }
  .settlement-print { background: white; color: black; padding: 0; min-height: auto; }
  .statement-sheet { max-width: none; padding: 0; border: 0; background: white; }
  .statement-sheet :deep(.text-ui-muted) { color: #444; }
  .statement-sheet section, .statement-sheet footer { break-inside: avoid; }
  .statement-sheet footer { padding-top: 8mm; min-height: 30mm; }
}
</style>
