<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({ title: 'In hợp đồng', layout: false })

const route = useRoute()
const contractRef = String(route.params.code)
const docId = String(route.params.docId)

const container = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const docxUrl = ref<string | null>(null)

useHead({ title: `hop-dong-${contractRef}` })

async function load() {
  isLoading.value = true
  error.value = null
  try {
    const res = await apiFetch<ApiSuccess<{ url: string, expiresIn: number }>>(`/api/contract-documents/${encodeURIComponent(docId)}/download`)
    docxUrl.value = res.data.url
    const file = await fetch(res.data.url)
    if (!file.ok) throw new Error('DOWNLOAD_FAILED')
    const blob = await file.blob()
    const { renderAsync } = await import('docx-preview')
    await nextTick()
    if (!container.value) return
    container.value.innerHTML = ''
    await renderAsync(blob, container.value, undefined, {
      className: 'contract-docx',
      inWrapper: true,
      ignoreLastRenderedPageBreak: true,
      // Tab stops align the party details; footers are skipped because the preview cannot number printed pages.
      experimental: true,
      renderFooters: false,
    })
  }
  catch (cause) {
    error.value = getApiErrorMessage(cause, 'Không thể hiển thị hợp đồng để in.')
  }
  finally {
    isLoading.value = false
  }
}

onMounted(load)

function printDocument() {
  if (!isLoading.value && !error.value) window.print()
}

function downloadDocx() {
  if (docxUrl.value) window.open(docxUrl.value, '_blank')
}
</script>

<template>
  <div class="contract-print min-h-screen bg-ui-canvas text-ui-primary">
    <header class="no-print mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-6">
      <NuxtLink :to="`/dashboard/contracts/${encodeURIComponent(contractRef)}#documents`" class="text-sm text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40">
        Về hợp đồng
      </NuxtLink>
      <div class="flex items-center gap-2">
        <UiButton v-if="docxUrl" size="sm" variant="secondary" data-test="print-download-docx" @click="downloadDocx">Tải DOCX</UiButton>
        <UiButton size="sm" :disabled="isLoading || !!error" data-test="print-pdf" @click="printDocument">In / lưu PDF</UiButton>
      </div>
    </header>

    <p v-if="!isLoading && !error" class="no-print mx-auto max-w-4xl px-3 pb-3 text-xs text-ui-muted sm:px-6">
      Trong hộp thoại in, chọn "Lưu dưới dạng PDF" để tải file PDF.
    </p>

    <div v-if="isLoading" class="no-print mx-auto max-w-4xl space-y-3 px-3 sm:px-6" aria-busy="true" aria-label="Đang tải hợp đồng">
      <UiSkeleton class="h-8 w-64" />
      <UiSkeleton class="h-96 w-full" />
    </div>
    <UiAlert v-else-if="error" severity="danger" class="no-print mx-auto max-w-4xl">
      {{ error }}
      <UiButton size="sm" variant="secondary" class="ml-2" @click="load">Thử lại</UiButton>
    </UiAlert>

    <div ref="container" class="contract-sheet overflow-x-auto" />
  </div>
</template>

<style scoped>
.contract-sheet :deep(.contract-docx-wrapper) {
  background: transparent;
  padding: 0 0 24px;
}

.contract-sheet :deep(.contract-docx-wrapper > section.contract-docx) {
  background: white;
  color: black;
  margin-bottom: 16px;
}

@media print {
  @page { size: A4; margin: 0; }
  .no-print { display: none !important; }
  .contract-print { background: white; min-height: auto; }
  .contract-sheet { overflow: visible; }
  .contract-sheet :deep(.contract-docx-wrapper) { background: white; padding: 0; }
  .contract-sheet :deep(.contract-docx-wrapper > section.contract-docx) {
    margin: 0;
    box-shadow: none;
    break-after: page;
  }
}
</style>
