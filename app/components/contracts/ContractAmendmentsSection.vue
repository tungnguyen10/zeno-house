<script setup lang="ts">
import type { ContractAmendment } from '~/types/contract-amendments'
import type { ContractWithDetails } from '~/types/contracts'
import type {
  ContractAmendmentCancelInput,
  ContractAmendmentCreateInput,
  ContractAmendmentUpdateInput,
} from '~/utils/validators/contract-amendments'
import { contractAmendmentDiff } from '~/utils/contract-amendments'
import { CONTRACT_AMENDMENT_TERM_LABELS } from '~/utils/constants/contracts'
import { formatViDate } from '~/utils/format/time'
import { getApiErrorMessage } from '~/utils/api-error'

const props = defineProps<{
  contract: ContractWithDetails
  amendments: ContractAmendment[]
  isLoading?: boolean
  error?: unknown
  canManage?: boolean
  createAmendment: (input: ContractAmendmentCreateInput) => Promise<ContractAmendment>
  updateAmendment: (id: string, input: ContractAmendmentUpdateInput) => Promise<ContractAmendment>
  removeAmendment: (id: string, expectedUpdatedAt: string) => Promise<void>
  publishAmendment: (id: string, expectedUpdatedAt: string) => Promise<ContractAmendment>
  cancelAmendment: (id: string, input: ContractAmendmentCancelInput) => Promise<ContractAmendment>
}>()

const emit = defineEmits<{ retry: [] }>()
const toast = useToast()
const editor = ref<'new' | string | null>(null)
const pendingAction = ref<{ kind: 'delete' | 'publish'; amendment: ContractAmendment } | null>(null)
const cancelling = ref<ContractAmendment | null>(null)
const cancelReason = ref('')
const busy = ref(false)

const editedAmendment = computed(() => editor.value && editor.value !== 'new'
  ? props.amendments.find(amendment => amendment.id === editor.value) ?? null
  : null)

function draftChangeLabels(amendment: ContractAmendment): string[] {
  return Object.keys(amendment.changes).map(key => CONTRACT_AMENDMENT_TERM_LABELS[key] ?? key)
}

async function saveDraft(input: ContractAmendmentCreateInput | ContractAmendmentUpdateInput) {
  busy.value = true
  try {
    if (editedAmendment.value && 'expected_updated_at' in input) {
      await props.updateAmendment(editedAmendment.value.id, input)
      toast.success('Đã cập nhật bản nháp')
    }
    else {
      await props.createAmendment(input as ContractAmendmentCreateInput)
      toast.success('Đã tạo phụ lục nháp')
    }
    editor.value = null
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không thể lưu phụ lục. Vui lòng thử lại.'))
  }
  finally {
    busy.value = false
  }
}

async function confirmAction() {
  if (!pendingAction.value) return
  busy.value = true
  try {
    const { kind, amendment } = pendingAction.value
    if (kind === 'publish') {
      await props.publishAmendment(amendment.id, amendment.updatedAt)
      toast.success('Đã ban hành phụ lục')
    }
    else {
      await props.removeAmendment(amendment.id, amendment.updatedAt)
      toast.success('Đã xóa bản nháp')
    }
    pendingAction.value = null
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không thể hoàn tất thao tác. Vui lòng thử lại.'))
  }
  finally {
    busy.value = false
  }
}

async function confirmCancel() {
  if (!cancelling.value || !cancelReason.value.trim()) return
  busy.value = true
  try {
    await props.cancelAmendment(cancelling.value.id, {
      expected_updated_at: cancelling.value.updatedAt,
      reason: cancelReason.value.trim(),
    })
    toast.success('Đã hủy phụ lục')
    cancelling.value = null
    cancelReason.value = ''
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không thể hủy phụ lục. Vui lòng thử lại.'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UiSection id="amendments" title="Phụ lục hợp đồng" class="mt-6 scroll-mt-20">
    <UiSurfacePanel density="compact">
      <div class="flex flex-col gap-3 border-b border-ui-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-sm text-ui-muted">Mỗi phụ lục đã ban hành là một bản ghi pháp lý bất biến.</p>
          <p v-if="contract.status !== 'active'" class="mt-1 text-xs text-status-warning">Hợp đồng không còn hiệu lực nên không thể tạo phụ lục mới.</p>
        </div>
        <UiButton
          v-if="canManage && contract.status === 'active' && editor === null"
          size="sm"
          @click="editor = 'new'"
        >
          Tạo phụ lục
        </UiButton>
      </div>

      <div v-if="editor" class="border-b border-ui-border py-5">
        <ContractAmendmentForm
          :contract="contract"
          :amendment="editedAmendment"
          :loading="busy"
          @submit="saveDraft"
          @cancel="editor = null"
        />
      </div>

      <div v-if="isLoading" class="space-y-3 pt-4" aria-label="Đang tải phụ lục">
        <UiSkeleton v-for="index in 2" :key="index" class="h-24 rounded-lg" />
      </div>
      <UiAlert v-else-if="error" severity="danger" class="mt-4">
        <div class="flex items-center justify-between gap-3">
          <span>Không thể tải danh sách phụ lục.</span>
          <UiButton size="sm" variant="secondary" @click="emit('retry')">Thử lại</UiButton>
        </div>
      </UiAlert>
      <UiEmptyState
        v-else-if="amendments.length === 0 && !editor"
        class="mt-4"
        title="Chưa có phụ lục"
        description="Các thay đổi điều khoản sẽ xuất hiện tại đây theo thứ tự ban hành."
      />

      <ol v-else class="divide-y divide-ui-border">
        <li v-for="amendment in amendments" :key="amendment.id" class="py-4 first:pt-5 last:pb-0">
          <article class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-ui-muted">Phụ lục số {{ amendment.sequenceNo }}</span>
                <UiStatusBadge :status="amendment.status" context="contract-amendment" />
              </div>
              <h3 class="mt-1 text-sm font-semibold text-ui-primary">{{ amendment.title }}</h3>
              <p class="mt-1 text-xs text-ui-muted">Hiệu lực {{ formatViDate(amendment.effectiveDate) }}</p>
              <p class="mt-3 whitespace-pre-line text-sm text-ui-primary">{{ amendment.publicContent }}</p>

              <dl v-if="contractAmendmentDiff(amendment.changes, amendment.beforeTerms, amendment.afterTerms).length" class="mt-3 grid gap-2 sm:grid-cols-2">
                <div
                  v-for="row in contractAmendmentDiff(amendment.changes, amendment.beforeTerms, amendment.afterTerms)"
                  :key="row.key"
                  class="rounded-md bg-ui-hover px-3 py-2"
                >
                  <dt class="text-xs text-ui-muted">{{ row.label }}</dt>
                  <dd class="mt-0.5 text-sm text-ui-primary"><span class="line-through opacity-70">{{ row.before }}</span> → <span class="font-medium">{{ row.after }}</span></dd>
                </div>
              </dl>
              <p v-else-if="amendment.status === 'draft'" class="mt-3 text-xs text-ui-muted">
                Thay đổi: {{ draftChangeLabels(amendment).join(', ') }}
              </p>
              <p v-if="amendment.status === 'cancelled' && amendment.cancellationReason" class="mt-3 text-xs text-status-danger">
                Lý do hủy: {{ amendment.cancellationReason }}
              </p>
            </div>

            <div v-if="canManage" class="flex flex-wrap items-start gap-2 lg:justify-end">
              <template v-if="amendment.status === 'draft'">
                <UiButton size="sm" variant="secondary" @click="editor = amendment.id">Sửa</UiButton>
                <UiButton size="sm" @click="pendingAction = { kind: 'publish', amendment }">Ban hành</UiButton>
                <UiButton size="sm" variant="danger" @click="pendingAction = { kind: 'delete', amendment }">Xóa nháp</UiButton>
              </template>
              <UiButton
                v-else-if="amendment.status === 'scheduled'"
                size="sm"
                variant="danger"
                @click="cancelling = amendment"
              >
                Hủy phụ lục
              </UiButton>
            </div>
          </article>
        </li>
      </ol>
    </UiSurfacePanel>

    <UiConfirmModal
      :open="pendingAction?.kind === 'delete'"
      title="Xóa bản nháp"
      message="Bản nháp sẽ bị xóa và không thể khôi phục."
      confirm-label="Xóa nháp"
      :loading="busy"
      @confirm="confirmAction"
      @cancel="pendingAction = null"
    />

    <UiModal :open="pendingAction?.kind === 'publish'" title="Ban hành phụ lục" size="sm" @close="pendingAction = null">
      <p class="text-sm text-ui-muted">
        Sau khi ban hành, nội dung và snapshot điều khoản sẽ bị khóa. Phụ lục hiệu lực hôm nay được áp dụng ngay.
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="pendingAction = null">Quay lại</UiButton>
        <UiButton :loading="busy" @click="confirmAction">Ban hành</UiButton>
      </template>
    </UiModal>

    <UiModal :open="cancelling !== null" title="Hủy phụ lục đã ban hành" size="sm" @close="cancelling = null">
      <UiTextarea
        v-model="cancelReason"
        label="Lý do hủy"
        :rows="3"
        hint="Lý do này được lưu trong lịch sử kiểm toán."
        required
      />
      <template #footer>
        <UiButton variant="secondary" @click="cancelling = null">Quay lại</UiButton>
        <UiButton variant="danger" :disabled="!cancelReason.trim()" :loading="busy" @click="confirmCancel">Xác nhận hủy</UiButton>
      </template>
    </UiModal>
  </UiSection>
</template>
