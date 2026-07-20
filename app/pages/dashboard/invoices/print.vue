<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { InvoicePrintItem } from '~/types/billing'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({ title: 'In hóa đơn', layout: false })

const route = useRoute()
const router = useRouter()
const { printNow } = useInvoicePrinting()
const requestedIds = String(route.query.ids ?? '').split(',').map(id => id.trim()).filter(Boolean)
const invoiceIds = [...new Set(requestedIds)]
const items = ref<InvoicePrintItem[]>([])
const loading = ref(true)
const errorMessage = ref<string | null>(null)

async function loadPrintData() {
  if (invoiceIds.length < 1 || invoiceIds.length > 100) {
    errorMessage.value = 'Chọn từ 1 đến 100 hoá đơn để in'
    loading.value = false
    return
  }
  try {
    const response = await apiFetch<ApiSuccess<InvoicePrintItem[]>>('/api/billing/invoices/print-data', {
      method: 'POST',
      body: { invoice_ids: invoiceIds },
    })
    items.value = response.data
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Không thể tải dữ liệu in')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadPrintData)

function triggerPrint() {
  if (items.value.length === 0 || errorMessage.value) return
  printNow(items.value.map(item => item.invoice.id))
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/dashboard/invoices')
}
</script>

<template>
  <div class="min-h-screen overflow-x-clip bg-dark text-white">
    <header class="no-print sticky top-0 z-10 flex flex-col items-start justify-between gap-3 border-b border-dark-border bg-dark-card px-4 py-3 sm:flex-row sm:items-center sm:px-6">
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Hóa đơn đã phát hành</p>
        <h1 class="mt-0.5 text-base font-semibold text-white">{{ items.length }} hóa đơn sẵn sàng in</h1>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <UiButton class="flex-1 sm:flex-none" variant="ghost" size="sm" @click="goBack">Đóng</UiButton>
        <UiButton class="flex-1 sm:flex-none" size="sm" :disabled="loading || !!errorMessage || items.length === 0" @click="triggerPrint">
          In ngay
        </UiButton>
      </div>
    </header>

    <div v-if="loading" class="px-6 py-16 text-center text-muted"><p>Đang tải dữ liệu...</p></div>
    <div v-else-if="errorMessage" class="px-6 py-16 text-center text-error-vivid"><p>{{ errorMessage }}</p></div>
    <div v-else-if="items.length === 0" class="px-6 py-16 text-center text-muted"><p>Không có hóa đơn nào để in.</p></div>
    <main v-else class="print-sheet">
      <InvoicePrintCard v-for="item in items" :key="item.invoice.id" :item="item" />
    </main>
  </div>
</template>

<style scoped>
.print-sheet { display: flex; width: min(210mm, calc(100vw - 24px)); flex-direction: column; gap: 6mm; margin: 24px auto; box-sizing: border-box; background: #fff; padding: 12mm; color: #111; box-shadow: 0 4px 16px rgb(0 0 0 / 40%); }
@media screen and (max-width: 640px) {
  .print-sheet { padding: 12px; }
}
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  .no-print { display: none !important; }
  .print-shell { min-height: auto; background: #fff; }
  .print-sheet { width: auto; margin: 0; padding: 0; box-shadow: none; }
  .print-sheet > :nth-child(2n):not(:last-child) { break-after: page; }
  .print-sheet > * { break-inside: avoid; }
}
</style>
