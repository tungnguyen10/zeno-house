<script setup lang="ts">
import type { ContractFormData } from '~/components/contracts/ContractForm.vue'

definePageMeta({ title: 'Thêm hợp đồng mới' })

const { isLoading, errors, apiError, submitCreate } = useContractForm()

const formData = ref<ContractFormData>({
  room_id: '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  monthly_rent: '',
  deposit: '',
  occupant_count: '1',
  discount_amount: '0',
  surcharge_amount: '0',
  status: 'active',
  notes: '',
})

async function onSubmit(data: ContractFormData) {
  const created = await submitCreate({
    room_id: data.room_id,
    tenant_id: data.tenant_id,
    start_date: data.start_date,
    end_date: data.end_date,
    monthly_rent: Number(data.monthly_rent),
    deposit: data.deposit ? Number(data.deposit) : 0,
    occupant_count: data.occupant_count ? Number(data.occupant_count) : 1,
    discount_amount: data.discount_amount ? Number(data.discount_amount) : 0,
    surcharge_amount: data.surcharge_amount ? Number(data.surcharge_amount) : 0,
    status: data.status,
    notes: data.notes || null,
  })
  if (created) {
    await navigateTo(`/contracts/${created.id}`)
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <NuxtLink to="/contracts" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách hợp đồng
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm hợp đồng mới</h1>
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <ContractForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        :api-error="apiError"
        @submit="onSubmit"
        @cancel="navigateTo('/contracts')"
      />
    </div>
  </div>
</template>
