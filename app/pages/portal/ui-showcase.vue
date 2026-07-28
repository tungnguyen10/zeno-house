<script setup lang="ts">
import type { TenantInvoiceListItem } from '~/types/tenant-portal'

definePageMeta({
  layout: 'tenant',
  middleware: () => {
    if (!import.meta.dev) return abortNavigation(createError({ statusCode: 404, statusMessage: 'Not Found' }))
  },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Portal showcase', back: '/portal' })

const sheetOpen = ref(false)
const name = ref('')
const message = ref('')
const { success, info } = usePortalToast()

const invoices: TenantInvoiceListItem[] = [
  { id: 'demo-1', invoiceCode: 'HD-2606-001', billingPeriodId: 'demo', periodYear: 2026, periodMonth: 6, buildingId: 'demo', buildingName: 'Zeno House', buildingSlug: 'zeno', roomId: 'demo', roomNumber: 'A101', contractId: 'demo', contractCode: 'HD-A101', totalAmount: 3200000, paidAmount: 3200000, balanceAmount: 0, dueDate: '2026-06-10', status: 'paid', issuedAt: null, voidedAt: null, voidReason: null, notes: null },
  { id: 'demo-2', invoiceCode: 'HD-2607-001', billingPeriodId: 'demo', periodYear: 2026, periodMonth: 7, buildingId: 'demo', buildingName: 'Zeno House', buildingSlug: 'zeno', roomId: 'demo', roomNumber: 'A101', contractId: 'demo', contractCode: 'HD-A101', totalAmount: 3300000, paidAmount: 1200000, balanceAmount: 2100000, dueDate: '2026-07-10', status: 'partial', issuedAt: null, voidedAt: null, voidReason: null, notes: null },
]

async function refreshDemo() {
  await Promise.resolve()
  info('Đã làm mới dữ liệu demo.')
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refreshDemo">
    <div class="space-y-8 px-4 py-6 lg:px-8">
      <section class="space-y-2">
        <p class="portal-type-label text-theme">Development only</p>
        <h2 class="portal-type-display text-title">Portal component showcase</h2>
        <p class="portal-type-body text-body">Header, sidebar, tab bar, toast host và install prompt được render bởi tenant layout.</p>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Actions & fields</h3>
        <PortalCard class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <PortalButton @click="success('Thao tác demo thành công.')">Primary</PortalButton>
            <PortalButton variant="secondary">Secondary</PortalButton>
            <PortalButton variant="ghost">Ghost</PortalButton>
            <PortalButton variant="danger">Danger</PortalButton>
            <PortalButton loading>Loading</PortalButton>
            <PortalButton disabled>Disabled</PortalButton>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <PortalTextField v-model="name" label="Tên hiển thị" placeholder="Nhập tên" hint="Fixture cục bộ" />
            <PortalTextField v-model="message" label="Trường lỗi" placeholder="Nhập nội dung" error="Đây là trạng thái lỗi demo." />
            <PortalTextField v-model="message" label="Ghi chú" textarea placeholder="Nhập ghi chú" />
            <PortalTextField v-model="name" label="Disabled" disabled placeholder="Không thể thay đổi" />
          </div>
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Information</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <PortalCard accent="paid" class="flex items-center justify-between gap-3"><div><p class="portal-type-label text-body">Đã thanh toán</p><p class="portal-money text-lg font-semibold text-title">3.200.000₫</p></div><PortalStatusBadge status="paid" /></PortalCard>
          <PortalCard accent="due" class="flex items-center justify-between gap-3"><div><p class="portal-type-label text-body">Còn phải trả</p><p class="portal-money text-lg font-semibold text-title">2.100.000₫</p></div><PortalPaymentRing :paid-amount="1200000" :total-amount="3300000" accent="due" /></PortalCard>
        </div>
        <PortalCard><PortalIdentityImageSlot label="Ảnh định danh" :signed-url="null" @select="info('Đã chọn ảnh demo.')" @remove="info('Đã xóa ảnh demo.')" @error="info" /></PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Feedback & data</h3>
        <div class="grid gap-3 sm:grid-cols-2"><PortalSkeleton variant="statement" /><PortalSkeleton variant="avatar" /></div>
        <PortalCard><PortalSpendingChart :invoices="invoices" /></PortalCard>
        <PortalCard><PortalEmptyState title="Chưa có yêu cầu" description="Đây là trạng thái rỗng của portal." action-label="Tạo yêu cầu" @action="info('Đã kích hoạt action demo.')" /></PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Overlays & installation</h3>
        <PortalCard class="flex flex-wrap gap-3"><PortalButton @click="sheetOpen = true">Mở bottom sheet</PortalButton><PortalButton variant="secondary" @click="info('Thông báo portal demo.')">Hiện toast</PortalButton><p class="portal-type-caption self-center text-body">PortalInstallPrompt đang được mount trong tenant layout.</p></PortalCard>
      </section>
    </div>
  </PortalPullToRefresh>

  <PortalBottomSheet v-model="sheetOpen" title="Bottom sheet demo"><p class="text-sm text-body">Overlay dùng cùng token light/dark với portal.</p><PortalButton block class="mt-4" @click="sheetOpen = false">Đóng</PortalButton></PortalBottomSheet>
</template>
