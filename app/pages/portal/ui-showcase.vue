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
  { id: 'demo-1', invoiceCode: 'HD-2606-001', billingPeriodId: 'demo', periodYear: 2026, periodMonth: 6, buildingId: 'demo', buildingName: 'Zeno House', buildingSlug: 'zeno', roomId: 'demo', roomNumber: 'A101', contractId: 'demo', contractCode: 'HD-A101', totalAmount: 3200000, paidAmount: 3200000, balanceAmount: 0, dueDate: '2026-06-10', gracePeriodDays: 0, overdueDate: '2026-06-10', status: 'paid', issuedAt: null, voidedAt: null, voidReason: null, notes: null },
  { id: 'demo-2', invoiceCode: 'HD-2607-001', billingPeriodId: 'demo', periodYear: 2026, periodMonth: 7, buildingId: 'demo', buildingName: 'Zeno House', buildingSlug: 'zeno', roomId: 'demo', roomNumber: 'A101', contractId: 'demo', contractCode: 'HD-A101', totalAmount: 3300000, paidAmount: 1200000, balanceAmount: 2100000, dueDate: '2026-07-10', gracePeriodDays: 2, overdueDate: '2026-07-12', status: 'partial', issuedAt: null, voidedAt: null, voidReason: null, notes: null },
]

const palette = [
  { name: 'Canvas', token: '--portal-bg', className: 'portal-swatch--canvas' },
  { name: 'Surface', token: '--portal-surface', className: 'portal-swatch--surface' },
  { name: 'Navy chrome', token: '--portal-chrome', className: 'portal-swatch--chrome' },
  { name: 'Teal accent', token: '--portal-accent', className: 'portal-swatch--accent' },
  { name: 'Positive', token: '--portal-positive', className: 'portal-swatch--positive' },
  { name: 'Warning', token: '--portal-warning', className: 'portal-swatch--warning' },
  { name: 'Danger', token: '--portal-danger', className: 'portal-swatch--danger' },
]

const spacing = [
  { value: '4', label: 'Tight label gap', className: 'portal-space-bar--1' },
  { value: '8', label: 'Inline control gap', className: 'portal-space-bar--2' },
  { value: '12', label: 'Card grid gap', className: 'portal-space-bar--3' },
  { value: '16', label: 'Card padding', className: 'portal-space-bar--4' },
  { value: '24', label: 'Section rhythm', className: 'portal-space-bar--6' },
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
        <h2 class="portal-type-display text-title">Portal foundation & components</h2>
        <p class="portal-type-body text-body">MapTrack primitives cho light/dark portal. Header, sidebar, tab bar, toast host và install prompt được render bởi tenant layout.</p>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Color Palette</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="color in palette" :key="color.token" class="portal-token-card">
            <span class="portal-swatch" :class="color.className" aria-hidden="true" />
            <div class="min-w-0"><p class="text-sm font-semibold text-title">{{ color.name }}</p><p class="portal-type-caption text-body">{{ color.token }}</p></div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Typography</h3>
        <PortalCard class="space-y-4">
          <div class="border-b border-border-light pb-4"><p class="portal-type-caption text-body">Display · page identity</p><p class="portal-type-display text-title">A calm way home</p></div>
          <div class="border-b border-border-light pb-4"><p class="portal-type-caption text-body">Heading · section structure</p><p class="portal-type-heading text-title">Hóa đơn tháng này</p></div>
          <div class="border-b border-border-light pb-4"><p class="portal-type-label text-body">Label · compact metadata</p><p class="portal-type-body text-title">Thanh toán qua chuyển khoản ngân hàng.</p></div>
          <p class="portal-type-caption text-body">Caption · hỗ trợ thao tác và thông tin thứ cấp.</p>
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Spacing</h3>
        <PortalCard class="space-y-3">
          <div v-for="item in spacing" :key="item.value" class="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
            <span class="portal-type-label text-title">{{ item.value }}px</span>
            <div class="min-w-0"><div class="portal-space-bar" :class="item.className" /><p class="portal-type-caption mt-1 text-body">{{ item.label }}</p></div>
          </div>
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Inputs</h3>
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
            <PortalInput v-model="name" label="Tên hiển thị" placeholder="Nhập tên" hint="Fixture cục bộ" />
            <PortalInput v-model="message" label="Trường lỗi" placeholder="Nhập nội dung" error="Đây là trạng thái lỗi demo." />
            <PortalInput v-model="message" label="Ghi chú" textarea placeholder="Nhập ghi chú" />
            <PortalInput v-model="name" label="Disabled" disabled placeholder="Không thể thay đổi" />
          </div>
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Elevation & Depth</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="portal-depth-sample portal-elevation-resting"><p class="text-sm font-semibold text-title">Resting surface</p><p class="portal-type-caption text-body">Card và content panel</p></div>
          <div class="portal-depth-sample portal-elevation-raised"><p class="text-sm font-semibold text-title">Raised overlay</p><p class="portal-type-caption text-body">Bottom sheet và modal</p></div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading text-title">Chips</h3>
        <PortalCard class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <PortalChip>Phòng A101</PortalChip>
            <PortalChip tone="accent" selected>Đang chọn</PortalChip>
            <PortalChip tone="success">Đã thanh toán</PortalChip>
            <PortalChip tone="warning">Chờ xử lý</PortalChip>
            <PortalChip tone="danger">Quá hạn</PortalChip>
          </div>
          <div class="flex flex-wrap gap-2">
            <PortalChip interactive @select="info('Đã chọn chip demo.')">Bộ lọc</PortalChip>
            <PortalChip interactive selected tone="accent" @select="info('Đã cập nhật lựa chọn demo.')">Ưu tiên</PortalChip>
            <PortalChip interactive disabled>Disabled</PortalChip>
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
