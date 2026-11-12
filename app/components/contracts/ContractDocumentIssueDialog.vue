<script setup lang="ts">
import type { ContractDocument, ContractDocumentMissing, ContractDocumentType } from '~/types/contract-documents'
import { getApiErrorMessage } from '~/utils/api-error'
import { useContractDocuments } from '~/composables/contracts/useContractDocuments'

const props = withDefaults(defineProps<{
  open: boolean
  contractId: string
  type?: ContractDocumentType
  amendmentId?: string | null
}>(), { type: 'contract', amendmentId: null })

const emit = defineEmits<{ close: []; issued: [doc: ContractDocument] }>()

const docs = useContractDocuments(() => props.contractId)
const signedDate = ref(new Date().toISOString().slice(0, 10))
const checking = ref(false)
const working = ref(false)
const ready = ref(false)
const missing = ref<ContractDocumentMissing[]>([])
const error = ref<string | null>(null)

async function runCheck() {
  checking.value = true
  error.value = null
  try {
    const res = await docs.check(props.type, props.amendmentId)
    ready.value = res.ready
    missing.value = res.missing
  }
  catch (cause) {
    error.value = getApiErrorMessage(cause, 'Không thể kiểm tra dữ liệu hợp đồng.')
  }
  finally {
    checking.value = false
  }
}

watch(() => props.open, (open) => { if (open) runCheck() }, { immediate: true })

async function onPreview() {
  working.value = true
  error.value = null
  try {
    await docs.preview({ type: props.type, amendment_id: props.amendmentId, signed_date: signedDate.value })
  }
  catch (cause) {
    error.value = getApiErrorMessage(cause, 'Không thể tạo bản xem trước.')
  }
  finally {
    working.value = false
  }
}

async function onIssue() {
  working.value = true
  error.value = null
  try {
    const doc = await docs.issue({ type: props.type, amendment_id: props.amendmentId, signed_date: signedDate.value })
    emit('issued', doc)
    emit('close')
  }
  catch (cause) {
    error.value = getApiErrorMessage(cause, 'Không thể phát hành tài liệu.')
  }
  finally {
    working.value = false
  }
}
</script>

<template>
  <UiModal :open="open" title="Xuất hợp đồng" @close="emit('close')">
    <div class="space-y-4">
      <UiDatePicker v-model="signedDate" label="Ngày ký" />

      <div v-if="checking" class="text-sm text-ui-muted">Đang kiểm tra dữ liệu…</div>

      <UiAlert v-else-if="missing.length" severity="warning" data-test="issue-missing">
        <p class="font-medium">Thiếu thông tin để phát hành:</p>
        <ul class="mt-1 list-disc pl-5 text-sm">
          <li v-for="m in missing" :key="m.code">{{ m.label }}</li>
        </ul>
      </UiAlert>

      <p v-else-if="ready" class="text-sm text-ui-muted">Đủ thông tin để phát hành hợp đồng.</p>

      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="working" @click="emit('close')">Đóng</UiButton>
      <UiButton
        v-if="ready"
        variant="secondary"
        :loading="working"
        data-test="issue-preview"
        @click="onPreview"
      >
        Xem trước (không lưu)
      </UiButton>
      <UiButton
        v-if="ready"
        variant="primary"
        :loading="working"
        data-test="issue-confirm"
        @click="onIssue"
      >
        Phát hành
      </UiButton>
    </template>
  </UiModal>
</template>
