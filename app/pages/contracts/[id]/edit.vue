<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractFormData } from '~/components/contracts/ContractForm.vue'

definePageMeta({ title: 'Chỉnh sửa hợp đồng' })

const route = useRoute()
const id = route.params.id as string

const { data, error } = await useFetch<ApiSuccess<ContractWithDetails>>(`/api/contracts/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/contracts')
}

const contract = computed(() => data.value?.data ?? null)

const { isLoading, errors, apiError, submitUpdate } = useContractForm()

const formData = ref<ContractFormData>({
  room_id: contract.value?.roomId ?? '',
  tenant_id: contract.value?.tenantId ?? '',
  start_date: contract.value?.startDate ?? '',
  end_date: contract.value?.endDate ?? '',
  monthly_rent: String(contract.value?.monthlyRent ?? ''),
  deposit: String(contract.value?.deposit ?? ''),
  status: contract.value?.status ?? 'active',
  notes: contract.value?.notes ?? '',
})

async function onSubmit(data: ContractFormData) {
  const updated = await submitUpdate(id, {
    room_id: data.room_id || undefined,
    tenant_id: data.tenant_id || undefined,
    start_date: data.start_date || undefined,
    end_date: data.end_date || undefined,
    monthly_rent: data.monthly_rent ? Number(data.monthly_rent) : undefined,
    deposit: data.deposit !== '' ? Number(data.deposit) : undefined,
    status: data.status,
    notes: data.notes || null,
  })
  if (updated) {
    await navigateTo(`/contracts/${id}`)
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <NuxtLink :to="`/contracts/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← Chi tiết hợp đồng
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Chỉnh sửa hợp đồng</h1>
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <ContractForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        :api-error="apiError"
        @submit="onSubmit"
        @cancel="navigateTo(`/contracts/${id}`)"
      />
    </div>
  </div>
</template>
