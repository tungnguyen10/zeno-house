<script setup lang="ts">
import type { ContractDocument, ContractDocumentStatus } from '~/types/contract-documents'
import type { StatusVariant } from '~/utils/constants/statuses'
import { useContractDocuments } from '~/composables/contracts/useContractDocuments'

const props = defineProps<{ contractId: string }>()

const emit = defineEmits<{ documentsChanged: [documents: ContractDocument[]] }>()

const authStore = useAuthStore()
const docs = useContractDocuments(() => props.contractId)

const canIssue = computed(() => authStore.can('contract-documents.issue'))
const canSign = computed(() => authStore.can('contract-documents.sign'))
const canVoid = computed(() => authStore.can('contract-documents.void'))

const showIssue = ref(false)
const voidTarget = ref<ContractDocument | null>(null)
const voidReason = ref('')

const STATUS_LABELS: Record<ContractDocumentStatus, string> = {
  pending: 'Đang xử lý', failed: 'Lỗi tạo file', issued: 'Đã phát hành', signed: 'Đã ký', voided: 'Đã hủy',
}
const STATUS_VARIANTS: Record<ContractDocumentStatus, StatusVariant> = {
  pending: 'neutral', failed: 'danger', issued: 'accent', signed: 'success', voided: 'danger',
}
const typeLabel = (t: ContractDocument['type']) => (t === 'appendix' ? 'Phụ lục' : 'Hợp đồng')

function openPdf(docId: string) {
  void navigateTo(`/dashboard/contracts/${encodeURIComponent(props.contractId)}/documents/${encodeURIComponent(docId)}/print`, { open: { target: '_blank' } })
}

watch(docs.documents, documents => emit('documentsChanged', documents))
onMounted(docs.refresh)

const voidValid = computed(() => voidReason.value.trim().length >= 10)

async function confirmVoid() {
  if (!voidTarget.value || !voidValid.value) return
  await docs.voidDocument(voidTarget.value.id, voidReason.value.trim())
  voidTarget.value = null
  voidReason.value = ''
}
</script>

<template>
  <section id="documents" class="scroll-mt-20">
    <UiSurfacePanel as="div" density="default">
      <header class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-ui-primary">Tài liệu</h2>
        <UiButton v-if="canIssue" size="sm" variant="secondary" data-test="documents-issue" @click="showIssue = true">
          Xuất hợp đồng
        </UiButton>
      </header>

      <div v-if="docs.isLoading.value" class="text-sm text-ui-muted">Đang tải…</div>
      <UiAlert v-else-if="docs.error.value" severity="danger">{{ docs.error.value }}</UiAlert>
      <p v-else-if="!docs.documents.value.length" class="text-sm text-ui-muted">Chưa có tài liệu nào.</p>

      <ul v-else class="divide-y divide-ui-border">
        <li v-for="d in docs.documents.value" :key="d.id" class="flex items-center gap-3 py-3" data-test="document-row">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p class="text-sm font-medium text-ui-primary">{{ typeLabel(d.type) }} · bản {{ d.versionNo }}</p>
              <UiBadge :variant="STATUS_VARIANTS[d.status]">{{ STATUS_LABELS[d.status] }}</UiBadge>
            </div>
            <p class="mt-0.5 truncate text-xs text-ui-muted tabular-nums">
              Mẫu v{{ d.templateVersion }}<span v-if="d.issuedAt"> · {{ new Date(d.issuedAt).toLocaleDateString('vi-VN') }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UiButton
              v-if="d.status === 'issued' || d.status === 'signed'"
              size="sm" variant="secondary" data-test="document-download-pdf"
              @click="openPdf(d.id)"
            >
              <IconDownload class="size-3.5" aria-hidden="true" />
              PDF
            </UiButton>
            <UiButton v-else-if="canIssue && d.status === 'failed'" size="sm" variant="secondary" @click="docs.regenerate(d.id)">
              Tạo lại file
            </UiButton>
            <UiDropdownMenu
              v-if="d.status === 'issued' || d.status === 'signed' || (canVoid && d.status === 'failed')"
              :aria-label="`Hành động ${typeLabel(d.type).toLowerCase()} bản ${d.versionNo}`"
            >
              <UiDropdownMenuItem v-if="canSign && d.status === 'issued'" @click="docs.sign(d.id)">
                <template #icon><IconCheckCircle class="size-4" aria-hidden="true" /></template>
                Đánh dấu đã ký
              </UiDropdownMenuItem>
              <UiDropdownMenuItem v-if="d.status === 'issued' || d.status === 'signed'" data-test="document-download" @click="docs.download(d.id)">
                <template #icon><IconDocumentText class="size-4" aria-hidden="true" /></template>
                Tải DOCX
              </UiDropdownMenuItem>
              <UiDropdownMenuItem v-if="canVoid" variant="danger" data-test="document-void" @click="voidTarget = d">
                <template #icon><IconXCircle class="size-4" aria-hidden="true" /></template>
                Hủy &amp; phát hành lại
              </UiDropdownMenuItem>
            </UiDropdownMenu>
          </div>
        </li>
      </ul>
    </UiSurfacePanel>

    <ContractDocumentIssueDialog
      :open="showIssue"
      :contract-id="contractId"
      type="contract"
      @close="showIssue = false"
      @issued="docs.refresh()"
    />

    <UiModal :open="voidTarget !== null" title="Hủy tài liệu" @close="voidTarget = null">
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">Nêu lý do hủy (tối thiểu 10 ký tự). Bản bị hủy không thể khôi phục.</p>
        <UiTextarea v-model="voidReason" label="Lý do hủy" :rows="3" />
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="voidTarget = null">Đóng</UiButton>
        <UiButton variant="danger" :disabled="!voidValid" data-test="void-confirm" @click="confirmVoid">Hủy tài liệu</UiButton>
      </template>
    </UiModal>
  </section>
</template>
