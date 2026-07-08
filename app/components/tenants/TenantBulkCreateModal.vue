<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import clsx from 'clsx'
import type { TenantBulkCreateResult } from '~/composables/tenants/useTenantBulkCreate'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done', result: TenantBulkCreateResult): void
}>()

const {
  fileName,
  previewRows,
  parseError,
  submitError,
  isParsing,
  isSubmitting,
  totalRows,
  validRows,
  invalidRows,
  canSubmit,
  parseFile,
  submit,
  reset,
} = useTenantBulkCreate()

const templateMenuOpen = ref(false)
const templateMenuRef = ref<HTMLElement | null>(null)
const templateTriggerRef = ref<HTMLElement | null>(null)

const previewLimit = 30
const visibleRows = computed(() => previewRows.value.slice(0, previewLimit))

function closeModal() {
  templateMenuOpen.value = false
  reset()
  emit('close')
}

function toggleTemplateMenu() {
  templateMenuOpen.value = !templateMenuOpen.value
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await parseFile(file)
}

async function onSubmit() {
  const result = await submit()
  if (!result) return
  emit('done', result)
  closeModal()
}

onClickOutside(templateMenuRef, () => {
  templateMenuOpen.value = false
}, { ignore: [templateTriggerRef] })

onKeyStroke('Escape', () => {
  if (templateMenuOpen.value) templateMenuOpen.value = false
})

watch(() => props.open, (next) => {
  if (!next) {
    templateMenuOpen.value = false
    reset()
  }
})
</script>

<template>
  <UiModal
    :open="open"
    title="Thêm nhanh nhiều khách thuê"
    size="xl"
    @close="closeModal"
  >
    <div class="space-y-4">
      <UiAlert severity="info">
        <p class="text-sm text-white">
          Tải file mẫu, điền dữ liệu rồi nhập lại vào hệ thống. File mẫu chứa đầy đủ tất cả trường của khách thuê.
        </p>
      </UiAlert>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <UiButton
            ref="templateTriggerRef"
            unstyled
            class="inline-flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-dark-hover"
            :aria-expanded="templateMenuOpen"
            aria-haspopup="menu"
            @click="toggleTemplateMenu"
          >
            <span>Tải file mẫu</span>
            <IconChevronDown
              :class="clsx('h-3 w-3 transition-transform duration-150', templateMenuOpen && 'rotate-180')"
              aria-hidden="true"
            />
          </UiButton>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-1 scale-95"
          >
            <div
              v-if="templateMenuOpen"
              ref="templateMenuRef"
              role="menu"
              class="absolute left-0 z-30 mt-2 w-52 origin-top-left overflow-hidden rounded-lg border border-dark-border bg-dark-card shadow-xl shadow-black/40"
            >
              <a
                role="menuitem"
                href="/templates/tenant-import-template.csv"
                download
                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover"
                @click="templateMenuOpen = false"
              >
                Tải mẫu CSV
              </a>
              <a
                role="menuitem"
                href="/templates/tenant-import-template.xlsx"
                download
                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover"
                @click="templateMenuOpen = false"
              >
                Tải mẫu XLSX
              </a>
            </div>
          </Transition>
        </div>

        <label
          for="tenant-bulk-file"
          class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white transition-colors hover:bg-dark-hover"
        >
          <IconDocument class="h-4 w-4" aria-hidden="true" />
          <span>Chọn file CSV/XLSX</span>
        </label>
        <input
          id="tenant-bulk-file"
          type="file"
          class="sr-only"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="onFileChange"
        >

        <span v-if="fileName" class="text-xs text-muted">Đã chọn: {{ fileName }}</span>
      </div>

      <UiAlert v-if="parseError" severity="danger">
        {{ parseError }}
      </UiAlert>

      <UiAlert v-if="submitError" severity="danger">
        {{ submitError }}
      </UiAlert>

      <div v-if="totalRows > 0" class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-3">
        <span>Tổng dòng: <strong class="text-white">{{ totalRows }}</strong></span>
        <span>Hợp lệ: <strong class="text-emerald-300">{{ validRows }}</strong></span>
        <span>Lỗi: <strong class="text-rose-300">{{ invalidRows }}</strong></span>
      </div>

      <div v-if="previewRows.length > 0" class="overflow-x-auto rounded-lg border border-dark-border">
        <table class="min-w-full divide-y divide-dark-border text-xs">
          <thead class="bg-dark-surface/70 text-muted">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Dòng</th>
              <th class="px-3 py-2 text-left font-medium">Họ tên</th>
              <th class="px-3 py-2 text-left font-medium">Số điện thoại</th>
              <th class="px-3 py-2 text-left font-medium">Email</th>
              <th class="px-3 py-2 text-left font-medium">CMND/CCCD</th>
              <th class="px-3 py-2 text-left font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border bg-dark-card/40">
            <tr v-for="row in visibleRows" :key="row.line">
              <td class="px-3 py-2 text-muted">{{ row.line }}</td>
              <td class="px-3 py-2 text-white">{{ row.full_name ?? '—' }}</td>
              <td class="px-3 py-2 text-white">{{ row.phone ?? '—' }}</td>
              <td class="px-3 py-2 text-white">{{ row.email ?? '—' }}</td>
              <td class="px-3 py-2 text-white">{{ row.id_number ?? '—' }}</td>
              <td class="px-3 py-2">
                <span
                  :class="clsx(
                    'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
                    row.issues.length === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
                  )"
                >
                  {{ row.issues.length === 0 ? 'Hợp lệ' : 'Có lỗi' }}
                </span>
                <p v-if="row.issues.length > 0" class="mt-1 text-[11px] text-rose-300">
                  {{ row.issues[0] }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="previewRows.length > previewLimit" class="text-xs text-muted">
        Đang hiển thị {{ previewLimit }} dòng đầu tiên để kiểm tra nhanh.
      </p>

      <UiAlert severity="info">
        <p class="text-xs text-muted">
          Trường bắt buộc khi nhập: <strong class="text-white">Họ và tên</strong> và <strong class="text-white">Số điện thoại</strong>
          (tương ứng cột <strong class="text-white">full_name</strong> và <strong class="text-white">phone</strong>).
          Các trường còn lại là tùy chọn nhưng vẫn có sẵn trong file mẫu để bạn điền đầy đủ khi cần.
        </p>
      </UiAlert>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="closeModal">Huỷ</UiButton>
      <UiButton :loading="isParsing || isSubmitting" :disabled="!canSubmit" @click="onSubmit">
        Nhập danh sách
      </UiButton>
    </template>
  </UiModal>
</template>
