<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractFormData } from '~/components/contracts/ContractForm.vue'
import { contractPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Chỉnh sửa hợp đồng' })

const route = useRoute()
const id = route.params.code as string

const { data, error } = await useFetch<ApiSuccess<ContractWithDetails>>(`/api/contracts/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/contracts')
}

const contract = computed(() => data.value?.data ?? null)

const formData = ref<ContractFormData>({
  room_id: contract.value?.roomId ?? '',
  tenant_id: contract.value?.tenantId ?? '',
  start_date: contract.value?.startDate ?? '',
  end_date: contract.value?.endDate ?? '',
  monthly_rent: String(contract.value?.monthlyRent ?? ''),
  deposit: String(contract.value?.deposit ?? ''),
  payment_day: contract.value?.paymentDay != null ? String(contract.value.paymentDay) : '',
  occupant_count: String(contract.value?.occupantCount ?? '1'),
  discount_amount: String(contract.value?.discountAmount ?? '0'),
  surcharge_amount: String(contract.value?.surchargeAmount ?? '0'),
  status: (contract.value?.status === 'renewed' ? 'expired' : contract.value?.status) ?? 'active',
  notes: contract.value?.notes ?? '',
  handover_electricity_reading: '',
  handover_water_reading: '',
  handover_reading_date: '',
})
const initialSnapshot = computed<ContractFormData | null>(() => contract.value
  ? {
      room_id: contract.value.roomId,
      tenant_id: contract.value.tenantId,
      start_date: contract.value.startDate,
      end_date: contract.value.endDate,
      monthly_rent: String(contract.value.monthlyRent ?? ''),
      deposit: String(contract.value.deposit ?? ''),
      payment_day: contract.value.paymentDay != null ? String(contract.value.paymentDay) : '',
      occupant_count: String(contract.value.occupantCount ?? '1'),
      discount_amount: String(contract.value.discountAmount ?? '0'),
      surcharge_amount: String(contract.value.surchargeAmount ?? '0'),
      status: (contract.value.status === 'renewed' ? 'expired' : contract.value.status) as ContractFormData['status'],
      notes: contract.value.notes ?? '',
      handover_electricity_reading: '',
      handover_water_reading: '',
      handover_reading_date: '',
    }
  : null)

const {
  isLoading,
  errors,
  apiError,
  submitUpdate,
  hasDraft,
  draftSavedAt,
  draftError,
  isDraftVersionMismatch,
  restoreDraft,
  clearDraft,
  isDirty,
} = useContractForm<ContractFormData>({
  draftKey: { mode: 'edit', id },
  formData,
  initialSnapshot,
})

async function onSubmit(data: ContractFormData) {
  const updated = await submitUpdate(id, {
    room_id: data.room_id || undefined,
    tenant_id: data.tenant_id || undefined,
    start_date: data.start_date || undefined,
    end_date: data.end_date || undefined,
    monthly_rent: data.monthly_rent ? Number(data.monthly_rent) : undefined,
    deposit: data.deposit !== '' ? Number(data.deposit) : undefined,
    payment_day: data.payment_day !== '' ? Number(data.payment_day) : null,
    occupant_count: data.occupant_count ? Number(data.occupant_count) : undefined,
    discount_amount: data.discount_amount !== '' ? Number(data.discount_amount) : undefined,
    surcharge_amount: data.surcharge_amount !== '' ? Number(data.surcharge_amount) : undefined,
    status: data.status,
    notes: data.notes || null,
  })
  if (updated) {
    clearNuxtData()
    await navigateTo(contractPath(updated))
  }
}

const { showLeaveConfirm, confirmLeave, cancelLeave } = useDirtyGuard(isDirty, isLoading)
</script>

<template>
  <div class="">
    <UiPageHeader title="Chỉnh sửa hợp đồng">
      <NuxtLink :to="contract ? contractPath(contract) : `/contracts/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← Chi tiết hợp đồng
      </NuxtLink>
    </UiPageHeader>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <ContractForm
        v-model="formData"
        :exclude-contract-id="id"
        :loading="isLoading"
        :errors="errors"
        :api-error="apiError"
        :has-draft="hasDraft"
        :draft-saved-at="draftSavedAt"
        :draft-error="draftError"
        :is-draft-version-mismatch="isDraftVersionMismatch"
        :is-dirty="isDirty"
        @submit="onSubmit"
        @cancel="navigateTo(contract ? contractPath(contract) : `/contracts/${id}`)"
        @restore-draft="restoreDraft"
        @clear-draft="clearDraft"
      />
    </div>

    <UiConfirmModal
      :open="showLeaveConfirm"
      title="Rời trang?"
      message="Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?"
      confirm-label="Rời trang"
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>
