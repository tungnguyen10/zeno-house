<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

definePageMeta({ title: 'UI Showcase' })

// Form state
const inputValue = ref('')
const inputWithError = ref('')
const inputWithSuffix = ref('')
const datePickerValue = ref('2026-07-08')
const textareaValue = ref('')
const selectValue = ref<string | null>(null)
const checkboxValue = ref(false)
const toggleValue = ref(true)

// UiCombobox demo
interface DemoOption {
  id: string
  name: string
}
const comboboxOptions: DemoOption[] = [
  { id: 'r1', name: 'P101 — Toà A (Đang trống)' },
  { id: 'r2', name: 'P102 — Toà A (Đang trống)' },
  { id: 'r3', name: 'P201 — Toà A (Đã thuê)' },
  { id: 'r4', name: 'B305 — Toà B (Đang trống)' },
  { id: 'r5', name: 'B306 — Toà B (Bảo trì)' },
]
const comboboxSelected = ref<DemoOption | null>(null)
const comboboxDisabled = ref<DemoOption | null>(null)
const comboboxLoading = ref<DemoOption | null>(null)
const comboboxError = ref<DemoOption | null>(null)

// Compact density demo
const compactInput = ref('')
const compactSelect = ref<string | null>(null)
const compactTextarea = ref('')

interface DensityDemoRow { id: number }
const densityDemoRows: DensityDemoRow[] = [{ id: 1 }, { id: 2 }]
const densityDemoColumns: UiTableColumn<DensityDemoRow>[] = [
  { key: 'roomNumber', label: 'Phòng' },
  { key: 'type', label: 'Loại' },
  { key: 'quantity', label: 'Số lượng', numeric: true },
  { key: 'notes', label: 'Ghi chú' },
]

// Modal state
const modalSm = ref(false)
const modalMd = ref(false)
const modalLg = ref(false)
const modalXl = ref(false)
const confirmOpen = ref(false)
const drawerOpen = ref(false)
const toast = useToast()

// Tabs
const activeTab = ref('overview')
const tabs = [
  { key: 'overview', label: 'Tổng quan', count: 12 },
  { key: 'readings', label: 'Chỉ số', count: 5 },
  { key: 'review', label: 'Soát lại', count: 2 },
  { key: 'invoices', label: 'Hóa đơn' },
  { key: 'audit', label: 'Audit', disabled: true, reason: 'Chưa phát hành kỳ' },
]

// Select options
const selectOptions = [
  { value: 'available', label: 'Trống' },
  { value: 'occupied', label: 'Đã có người thuê' },
  { value: 'maintenance', label: 'Đang bảo trì' },
]

// Table demo
interface DemoRow {
  id: string
  code: string
  building: string
  status: string
  rent: number
  area: number | null
}

const tableLoading = ref(false)
const tableEmpty = ref(false)
const demoRows: DemoRow[] = [
  { id: '1', code: 'P101', building: 'Toà A', status: 'occupied', rent: 4_500_000, area: 22 },
  { id: '2', code: 'P102', building: 'Toà A', status: 'available', rent: 4_200_000, area: 18 },
  { id: '3', code: 'P201', building: 'Toà A', status: 'maintenance', rent: 5_000_000, area: 25 },
  { id: '4', code: 'B305', building: 'Toà B', status: 'occupied', rent: 6_500_000, area: 30 },
]

const tableRows = computed(() => (tableEmpty.value ? [] : demoRows))

const columns: UiTableColumn<DemoRow>[] = [
  { key: 'code', label: 'Mã phòng' },
  { key: 'building', label: 'Toà nhà', hideOnMobile: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'rent', label: 'Giá thuê', numeric: true },
  { key: 'area', label: 'Diện tích', numeric: true, hideOnMobile: true },
  { key: 'actions', label: 'Thao tác', action: true, width: 'w-32' },
]

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

// Status demo lists
const entityStatuses = ['active', 'inactive', 'pending', 'terminated', 'available', 'occupied', 'maintenance', 'expired']
const periodStatuses = ['draft', 'readings', 'review', 'issued', 'collecting', 'closed']
const invoiceStatuses = ['draft', 'issued', 'partial', 'paid', 'overdue', 'void']
const correctionStatuses = ['blocked', 'warning', 'adjustment', 'replacement', 'corrected']

// Badge variants
const badgeVariants: { variant: 'neutral' | 'accent' | 'success' | 'warning' | 'danger', label: string }[] = [
  { variant: 'neutral', label: 'Neutral' },
  { variant: 'accent', label: 'Accent' },
  { variant: 'success', label: 'Success' },
  { variant: 'warning', label: 'Warning' },
  { variant: 'danger', label: 'Danger' },
]

// Alerts
const dismissedAlerts = ref<string[]>([])
function dismissAlert(key: string) {
  if (!dismissedAlerts.value.includes(key)) dismissedAlerts.value.push(key)
}
</script>

<template>
  <div class="space-y-10">
    <UiPageHeader
      title="UI Showcase"
      description="Tổng hợp tất cả primitive trong app/components/ui — dùng để kiểm tra visual và behavior."
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="$router.back()">← Quay lại</UiButton>
      </template>
    </UiPageHeader>

    <!-- Buttons -->
    <UiSection title="UiButton" description="Variants, sizes, states, icon-only.">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <UiButton variant="primary">Primary</UiButton>
          <UiButton variant="secondary">Secondary</UiButton>
          <UiButton variant="danger">Danger</UiButton>
          <UiButton variant="ghost">Ghost</UiButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UiButton size="sm">Size sm</UiButton>
          <UiButton size="md">Size md</UiButton>
          <UiButton size="lg">Size lg</UiButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UiButton loading>Loading</UiButton>
          <UiButton disabled>Disabled</UiButton>
          <UiButton variant="ghost" icon-only aria-label="Tìm kiếm">
            <IconSearch class="h-4 w-4" aria-hidden="true" />
          </UiButton>
          <UiButton variant="secondary" icon-only aria-label="Cài đặt">
            <IconSettings class="h-4 w-4" aria-hidden="true" />
          </UiButton>
        </div>
      </div>
    </UiSection>

    <!-- Form Inputs -->
    <UiSection title="UiInput & UiDatePicker" description="Stable id, prefix/suffix, error, hint, calendar date picking.">
      <div class="grid gap-4 md:grid-cols-2">
        <UiInput v-model="inputValue" label="Tên tòa nhà" placeholder="Nhập tên..." required />
        <UiInput v-model="inputWithError" label="Email" placeholder="email@example.com" error="Email không hợp lệ" />
        <UiDatePicker v-model="datePickerValue" label="Ngày thanh toán" date-mode="payment" />
        <UiInput label="Diện tích" hint="Đơn vị mét vuông" type="number" number-mode="area">
          <template #suffix>m²</template>
        </UiInput>
        <UiInput v-model="inputWithSuffix" label="Giá thuê" type="number" number-mode="currency">
          <template #prefix>đ</template>
          <template #suffix>/tháng</template>
        </UiInput>
        <UiInput label="Disabled" placeholder="Không thể nhập" disabled />
      </div>
    </UiSection>

    <UiSection title="UiSelect" description="Dropdown choice với label, error, placeholder.">
      <div class="grid gap-4 md:grid-cols-2">
        <UiSelect
          v-model="selectValue"
          label="Trạng thái phòng"
          :options="selectOptions"
          placeholder="Tất cả trạng thái"
        />
        <UiSelect
          label="Có lỗi"
          :options="selectOptions"
          placeholder="-- Chọn --"
          error="Vui lòng chọn trạng thái"
        />
        <UiSelect label="Disabled" :options="selectOptions" disabled placeholder="Khoá" />
        <UiSelect
          label="Required"
          :options="selectOptions"
          placeholder="-- Chọn --"
          required
          hint="Trường bắt buộc"
        />
      </div>
    </UiSection>

    <UiSection title="UiTextarea" description="Multiline với resize control.">
      <div class="grid gap-4 md:grid-cols-2">
        <UiTextarea v-model="textareaValue" label="Ghi chú" placeholder="Nhập ghi chú..." :rows="4" />
        <UiTextarea label="Có lỗi" :rows="4" error="Ghi chú không được để trống" />
        <UiTextarea label="Resize none" resize="none" :rows="3" placeholder="Không thể resize" />
        <UiTextarea label="Disabled" :rows="3" disabled />
      </div>
    </UiSection>

    <!-- UiCombobox -->
    <UiSection title="UiCombobox" description="Searchable selection — label, required, disabled, loading, empty, error, clear.">
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Normal / selected -->
        <UiCombobox
          v-model="comboboxSelected"
          label="Phòng"
          :options="comboboxOptions"
          :option-key="o => o.id"
          :option-label="o => o.name"
          placeholder="Chọn phòng..."
          required
        />
        <!-- Loading -->
        <UiCombobox
          v-model="comboboxLoading"
          label="Đang tải (loading)"
          :options="[]"
          :option-key="o => (o as DemoOption).id"
          :option-label="o => (o as DemoOption).name"
          placeholder="Chờ dữ liệu..."
          loading
        />
        <!-- Disabled -->
        <UiCombobox
          v-model="comboboxDisabled"
          label="Khoá (disabled)"
          :options="comboboxOptions"
          :option-key="o => o.id"
          :option-label="o => o.name"
          placeholder="Không thể chọn"
          disabled
        />
        <!-- Error -->
        <UiCombobox
          v-model="comboboxError"
          label="Có lỗi"
          :options="comboboxOptions"
          :option-key="o => o.id"
          :option-label="o => o.name"
          placeholder="Chọn phòng..."
          error="Vui lòng chọn phòng"
          required
        />
        <!-- Empty -->
        <UiCombobox
          v-model="comboboxSelected"
          label="Không có kết quả (empty options)"
          :options="[]"
          :option-key="o => o.id"
          :option-label="o => o.name"
          placeholder="Không có phòng nào"
          empty-message="Không tìm thấy phòng nào phù hợp"
        />
      </div>
      <p class="mt-3 text-xs text-muted">
        Đang chọn: <span class="text-cyan">{{ comboboxSelected ? comboboxSelected.name : '(chưa chọn)' }}</span>
      </p>
    </UiSection>

    <!-- Compact density -->
    <UiSection title="Compact density (UiInput / UiSelect / UiTextarea)" description="density=&quot;compact&quot; cho editable table cells, meter readings, billing review rows.">
      <UiTable :rows="densityDemoRows" :columns="densityDemoColumns">
        <template #cell-roomNumber="{ row }">
          <UiInput
            v-if="row.id === 1"
            v-model="compactInput"
            density="compact"
            placeholder="P101"
          />
          <UiInput v-else density="compact" placeholder="P102" />
        </template>
        <template #cell-type="{ row }">
          <UiSelect
            v-if="row.id === 1"
            v-model="compactSelect"
            density="compact"
            :options="selectOptions"
            placeholder="Chọn..."
          />
          <UiSelect
            v-else
            density="compact"
            :options="selectOptions"
            placeholder="Chọn..."
          />
        </template>
        <template #cell-quantity>
          <UiInput density="compact" type="number" number-mode="integer" placeholder="0" />
        </template>
        <template #cell-notes="{ row }">
          <UiTextarea
            v-if="row.id === 1"
            v-model="compactTextarea"
            density="compact"
            :rows="1"
            resize="none"
            placeholder="Ghi chú..."
          />
          <span v-else class="text-muted text-xs">—</span>
        </template>
      </UiTable>
      <p class="mt-2 text-xs text-muted">Compact controls maintain the same focus/error/disabled behavior — only sizing is reduced.</p>
    </UiSection>

    <UiSection title="UiCheckbox / UiToggle" description="Boolean controls.">      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3 rounded-xl border border-dark-border bg-dark-surface p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Checkbox</p>
          <UiCheckbox v-model="checkboxValue" label="Đồng ý điều khoản" />
          <UiCheckbox label="Đã chọn (mặc định)" :model-value="true" hint="Có thể click để bỏ chọn (mock)" />
          <UiCheckbox label="Có lỗi" error="Vui lòng đồng ý điều khoản" />
          <UiCheckbox label="Disabled" disabled />
        </div>
        <div class="space-y-3 rounded-xl border border-dark-border bg-dark-surface p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Toggle</p>
          <UiToggle v-model="toggleValue" label="Bật dịch vụ" />
          <UiToggle label="Toggle off" :model-value="false" />
          <UiToggle size="sm" label="Toggle nhỏ" :model-value="true" />
          <UiToggle label="Disabled" disabled />
        </div>
      </div>
    </UiSection>

    <!-- Badges & Status -->
    <UiSection title="UiBadge" description="Generic badge variants.">
      <div class="flex flex-wrap items-center gap-3">
        <UiBadge v-for="b in badgeVariants" :key="b.variant" :variant="b.variant">
          {{ b.label }}
        </UiBadge>
        <UiBadge variant="accent" pill>Pill</UiBadge>
        <UiBadge variant="success" size="md">Size md</UiBadge>
      </div>
    </UiSection>

    <UiSection title="UiStatusBadge" description="Domain status pill — delegates to UiBadge qua status map.">
      <div class="space-y-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Entity statuses</p>
          <div class="flex flex-wrap gap-2">
            <UiStatusBadge v-for="s in entityStatuses" :key="s" :status="s" />
          </div>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Billing period statuses</p>
          <div class="flex flex-wrap gap-2">
            <UiStatusBadge v-for="s in periodStatuses" :key="s" :status="s" context="period" />
          </div>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Invoice statuses</p>
          <div class="flex flex-wrap gap-2">
            <UiStatusBadge v-for="s in invoiceStatuses" :key="s" :status="s" context="invoice" />
          </div>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Correction statuses</p>
          <div class="flex flex-wrap gap-2">
            <UiStatusBadge v-for="s in correctionStatuses" :key="s" :status="s" context="correction" />
          </div>
        </div>
        <div class="rounded-md bg-dark-surface border border-dark-border p-3 text-xs text-muted">
          Cùng key <code class="text-cyan">issued</code> nhưng context khác →
          <UiStatusBadge status="issued" context="period" />
          <span class="mx-1">vs</span>
          <UiStatusBadge status="issued" context="invoice" />
          <span class="ml-2">(không context)</span>
          <UiStatusBadge status="issued" />
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Unknown fallback</p>
          <UiStatusBadge status="not-in-map" />
        </div>
      </div>
    </UiSection>

    <!-- Alerts -->
    <UiSection title="UiAlert" description="Inline feedback / blocker.">
      <div class="space-y-3">
        <UiAlert severity="info" title="Thông tin">Đang tải dữ liệu mới nhất từ server.</UiAlert>
        <UiAlert severity="success" title="Đã lưu">Cấu hình dịch vụ đã được lưu thành công.</UiAlert>
        <UiAlert severity="warning" title="Cần soát lại">Có 3 phòng chưa nhập chỉ số trong kỳ này.</UiAlert>
        <UiAlert severity="danger" title="Lỗi" dismissible @dismiss="dismissAlert('danger')">
          <span v-if="!dismissedAlerts.includes('danger')">
            Không thể tải danh sách. Vui lòng thử lại.
          </span>
          <span v-else class="text-muted">Đã đóng. Reload trang để hiện lại.</span>
        </UiAlert>
        <UiAlert severity="warning">Alert không có title — vẫn render được nội dung.</UiAlert>
      </div>
    </UiSection>

    <!-- Toolbar + Metric -->
    <UiSection title="UiToolbar" description="Filter row + actions on the right.">
      <UiToolbar>
        <UiInput placeholder="Tìm phòng..." class="w-full sm:w-64">
          <template #prefix>
            <IconSearch class="h-4 w-4" aria-hidden="true" />
          </template>
        </UiInput>
        <UiSelect :options="selectOptions" placeholder="Tất cả trạng thái" class="w-full sm:w-48" />
        <template #actions>
          <UiButton variant="secondary" size="md">Refresh</UiButton>
          <UiButton size="md">+ Thêm phòng</UiButton>
        </template>
      </UiToolbar>
    </UiSection>

    <UiSection title="UiMetric" description="Compact KPI strip cho operational workspace.">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <UiMetric label="Kỳ đang xử lý" value="06/2026" tone="accent" />
        <UiMetric label="Tổng phải thu" value="125.4M" caption="↑ 12% so với T5" />
        <UiMetric label="Đã thu" value="98.2M" tone="success" />
        <UiMetric label="Còn nợ" value="27.2M" tone="danger" />
        <UiMetric label="Thiếu chỉ số" value="3" tone="warning" />
        <UiMetric label="Loading..." value="--" loading />
      </div>
    </UiSection>

    <!-- Tabs -->
    <UiSection title="UiTabs" description="Workspace tab navigation.">
      <UiTabs v-model="activeTab" :tabs="tabs" />
      <div class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <p class="text-sm text-muted">Tab đang chọn: <span class="text-cyan font-medium">{{ activeTab }}</span></p>
      </div>
    </UiSection>

    <!-- Table -->
    <UiSection title="UiTable" description="Generic dense table với loading / empty / numeric / action columns.">
      <template #actions>
        <UiButton size="sm" variant="ghost" @click="tableLoading = !tableLoading">
          {{ tableLoading ? 'Tắt loading' : 'Bật loading' }}
        </UiButton>
        <UiButton size="sm" variant="ghost" @click="tableEmpty = !tableEmpty">
          {{ tableEmpty ? 'Có dữ liệu' : 'Empty state' }}
        </UiButton>
      </template>
      <UiTable
        :rows="tableRows"
        :columns="columns"
        :loading="tableLoading"
        empty-title="Chưa có phòng nào"
        empty-description="Bấm thêm phòng để bắt đầu."
      >
        <template #cell-code="{ row }">
          <span class="font-mono font-medium text-white">{{ row.code }}</span>
        </template>
        <template #cell-status="{ row }">
          <UiStatusBadge :status="row.status" />
        </template>
        <template #cell-rent="{ row }">
          {{ formatCurrency(row.rent) }}
        </template>
        <template #cell-area="{ row }">
          {{ row.area ? `${row.area} m²` : '—' }}
        </template>
        <template #cell-actions>
          <div class="flex justify-end gap-1">
            <UiButton size="sm" variant="ghost">Xem</UiButton>
            <UiButton size="sm" variant="ghost">Sửa</UiButton>
          </div>
        </template>
        <template #emptyAction>
          <UiButton>+ Thêm phòng đầu tiên</UiButton>
        </template>
      </UiTable>
    </UiSection>

    <!-- Modals -->
    <UiSection title="UiModal" description="Size variants sm / md / lg / xl + UiConfirmModal.">
      <div class="flex flex-wrap gap-3">
        <UiButton variant="secondary" @click="modalSm = true">Open sm</UiButton>
        <UiButton variant="secondary" @click="modalMd = true">Open md</UiButton>
        <UiButton variant="secondary" @click="modalLg = true">Open lg</UiButton>
        <UiButton variant="secondary" @click="modalXl = true">Open xl</UiButton>
        <UiButton variant="danger" @click="confirmOpen = true">Confirm Delete</UiButton>
      </div>

      <UiModal :open="modalSm" size="sm" title="Modal nhỏ" @close="modalSm = false">
        <p class="text-sm text-muted">Modal size sm thích hợp cho confirm ngắn gọn.</p>
        <template #footer>
          <UiButton variant="secondary" @click="modalSm = false">Đóng</UiButton>
        </template>
      </UiModal>

      <UiModal :open="modalMd" size="md" title="Modal trung bình (mặc định)" @close="modalMd = false">
        <p class="text-sm text-muted">Form vừa với 1 cột — giống UiConfirmModal.</p>
        <template #footer>
          <UiButton variant="secondary" @click="modalMd = false">Huỷ</UiButton>
          <UiButton @click="modalMd = false">Lưu</UiButton>
        </template>
      </UiModal>

      <UiModal :open="modalLg" size="lg" title="Modal lớn" @close="modalLg = false">
        <div class="grid gap-4 md:grid-cols-2">
          <UiInput label="Mã phòng" placeholder="P101" />
          <UiSelect label="Trạng thái" :options="selectOptions" placeholder="Chọn..." />
          <UiInput label="Diện tích" type="number" number-mode="area">
            <template #suffix>m²</template>
          </UiInput>
          <UiInput label="Giá thuê" type="number" number-mode="currency">
            <template #prefix>đ</template>
          </UiInput>
        </div>
        <template #footer>
          <UiButton variant="secondary" @click="modalLg = false">Huỷ</UiButton>
          <UiButton @click="modalLg = false">Lưu</UiButton>
        </template>
      </UiModal>

      <UiModal :open="modalXl" size="xl" title="Modal rất lớn (correction form)" @close="modalXl = false">
        <UiAlert severity="warning" class="mb-4">
          Đang điều chỉnh chỉ số đồng hồ. Hành động này được audit lại.
        </UiAlert>
        <div class="grid gap-4 md:grid-cols-3">
          <UiInput label="Chỉ số cũ" type="number" number-mode="meter" />
          <UiInput label="Chỉ số mới" type="number" number-mode="meter" />
          <UiInput label="Số đơn vị tính" type="number" number-mode="meter" />
        </div>
        <UiTextarea label="Lý do" :rows="3" class="mt-4" placeholder="Nhập lý do điều chỉnh..." />
        <template #footer>
          <UiButton variant="secondary" @click="modalXl = false">Huỷ</UiButton>
          <UiButton variant="danger" @click="modalXl = false">Lưu điều chỉnh</UiButton>
        </template>
      </UiModal>

      <UiConfirmModal
        :open="confirmOpen"
        title="Xoá phòng P101?"
        message="Phòng sẽ bị xoá vĩnh viễn và không thể khôi phục."
        confirm-label="Xoá phòng"
        @confirm="confirmOpen = false"
        @cancel="confirmOpen = false"
      />
    </UiSection>

    <UiSection title="UiDrawer / Toast" description="Right-side drawer and non-blocking feedback.">
      <div class="flex flex-wrap gap-2">
        <UiButton variant="secondary" @click="drawerOpen = true">Open drawer</UiButton>
        <UiButton @click="toast.success('Đã lưu thay đổi')">Success toast</UiButton>
        <UiButton variant="danger" @click="toast.error('Không thể lưu thay đổi')">Error toast</UiButton>
        <UiButton variant="ghost" @click="toast.info('Đang xử lý dữ liệu')">Info toast</UiButton>
      </div>

      <UiDrawer v-model="drawerOpen" title="Nhật ký thao tác">
        <div class="space-y-3">
          <p class="text-sm text-muted">Drawer dùng cho bề mặt tham chiếu như audit log hoặc chi tiết hoá đơn.</p>
          <UiAlert severity="info">Backdrop, Esc và nút đóng đều tắt drawer.</UiAlert>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UiButton variant="secondary" @click="drawerOpen = false">Đóng</UiButton>
          </div>
        </template>
      </UiDrawer>
    </UiSection>

    <!-- Empty / Skeleton -->
    <UiSection title="UiEmptyState / UiSkeleton" description="Helper components.">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-dark-border bg-dark-surface">
          <UiEmptyState
            title="Chưa có hợp đồng nào"
            description="Tạo hợp đồng đầu tiên để bắt đầu."
          >
            <template #action>
              <UiButton>+ Tạo hợp đồng</UiButton>
            </template>
          </UiEmptyState>
        </div>
        <div class="rounded-xl border border-dark-border bg-dark-surface">
          <UiEmptyState
            variant="success"
            title="Không có việc tồn"
            description="Mọi kỳ vận hành đã ổn."
          />
        </div>
        <div class="rounded-xl border border-dark-border bg-dark-surface">
          <UiEmptyState
            variant="search"
            size="sm"
            title="Không tìm thấy kết quả"
            description="Thử bỏ bớt bộ lọc hoặc đổi từ khoá."
          />
        </div>
        <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-3 md:col-span-3">
          <p class="text-xs uppercase tracking-wide text-muted">Skeletons</p>
          <UiSkeleton class="h-5 w-2/3" />
          <UiSkeleton class="h-4 w-full" />
          <UiSkeleton class="h-4 w-5/6" />
          <UiSkeleton class="h-32 w-full" />
        </div>
      </div>
    </UiSection>
  </div>
</template>
