<script setup lang="ts">
import type { ContractFormData } from '~/components/contracts/ContractForm.vue'
import type { ContractOccupantAddInput } from '~/utils/validators/contract-occupants'
import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Thêm hợp đồng mới' })

const route = useRoute()

const formData = ref<ContractFormData>({
  room_id: (route.query.room_id as string) || '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  monthly_rent: '',
  deposit: '',
  payment_day: '',
  occupant_count: '1',
  discount_amount: '0',
  surcharge_amount: '0',
  status: 'active',
  notes: '',
  handover_electricity_reading: '',
  handover_water_reading: '',
  handover_reading_date: '',
})
const initialSnapshot = ref<ContractFormData>({ ...formData.value })

interface PendingOccupant {
  tenant_id: string
  tenantName: string
  move_in_date: string
  billing_counted: boolean
}

const currentStep = ref(1)
const pendingOccupants = ref<PendingOccupant[]>([])
const selectedServices = ref<unknown[]>([])
const showOccupantForm = ref(false)
const occupantSubmitError = ref<string | null>(null)

const {
  isLoading,
  errors,
  apiError,
  submitCreate,
  hasDraft,
  draftSavedAt,
  draftError,
  isDraftVersionMismatch,
  restoreDraft,
  clearDraft,
  isDirty,
} = useContractForm<ContractFormData>({
  draftKey: { mode: 'create' },
  formData,
  initialSnapshot,
  wizardState: {
    currentStep,
    pendingOccupants: pendingOccupants as unknown as Ref<unknown[]>,
    selectedServices,
  },
})

const createdContractId = ref<string | null>(null)
const { services: contractServices, isLoading: servicesLoading, updateService } = useContractServices(
  computed(() => createdContractId.value ?? ''),
)

const { data: allTenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: { limit: 200, available: true },
})
const allTenants = computed(() => allTenantsData.value?.data ?? [])

const excludeTenantIds = computed(() =>
  [formData.value.tenant_id, ...pendingOccupants.value.map(occupant => occupant.tenant_id)].filter(Boolean),
)

const completedSteps = computed(() => {
  const steps: number[] = []
  if (currentStep.value > 1) steps.push(1)
  if (createdContractId.value) steps.push(2)
  return steps
})

function goStep(step: number) {
  if (step <= currentStep.value || completedSteps.value.includes(step)) currentStep.value = step
}

function onStepOneValid() {
  currentStep.value = 2
}

function handleAddPendingOccupant(input: ContractOccupantAddInput) {
  const tenant = allTenants.value.find(item => item.id === input.tenant_id)
  pendingOccupants.value.push({
    tenant_id: input.tenant_id,
    tenantName: tenant?.fullName ?? '-',
    move_in_date: input.move_in_date,
    billing_counted: input.billing_counted,
  })
  showOccupantForm.value = false
}

function removePendingOccupant(tenantId: string) {
  pendingOccupants.value = pendingOccupants.value.filter(occupant => occupant.tenant_id !== tenantId)
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function createContract(data: ContractFormData) {
  occupantSubmitError.value = null
  const created = await submitCreate({
    room_id: data.room_id,
    tenant_id: data.tenant_id,
    start_date: data.start_date,
    end_date: data.end_date,
    monthly_rent: Number(data.monthly_rent),
    deposit: data.deposit ? Number(data.deposit) : 0,
    payment_day: data.payment_day ? Number(data.payment_day) : null,
    occupant_count: data.occupant_count ? Number(data.occupant_count) : 1,
    discount_amount: data.discount_amount ? Number(data.discount_amount) : 0,
    surcharge_amount: data.surcharge_amount ? Number(data.surcharge_amount) : 0,
    status: data.status,
    notes: data.notes || null,
    handover_electricity_reading: Number(data.handover_electricity_reading),
    handover_water_reading: Number(data.handover_water_reading),
    handover_reading_date: data.handover_reading_date || undefined,
  })
  if (!created) return

  if (pendingOccupants.value.length > 0) {
    const results = await Promise.allSettled(
      pendingOccupants.value.map(occupant =>
        apiFetch(`/api/contracts/${created.id}/occupants`, {
          method: 'POST',
          body: {
            tenant_id: occupant.tenant_id,
            role: 'roommate',
            move_in_date: occupant.move_in_date,
            billing_counted: occupant.billing_counted,
          },
        }),
      ),
    )
    const failed = results.filter(result => result.status === 'rejected').length
    if (failed > 0) {
      occupantSubmitError.value = `${failed} người ở chưa thêm được — vui lòng thêm thủ công trên trang chi tiết.`
    }
  }

  createdContractId.value = created.id
  currentStep.value = 3
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm hợp đồng mới"
      description="Khai báo hợp đồng, thêm người ở chung và cấu hình dịch vụ theo từng bước."
      :back-to="'/contracts'"
      back-label="Danh sách hợp đồng"
    />

    <div class="space-y-6">
      <ContractWizardSteps
        :current-step="currentStep"
        :completed-steps="completedSteps"
        @change="goStep"
      />

      <section v-if="currentStep === 1" class="rounded-xl border border-dark-border bg-dark-surface p-6">
        <ContractForm
          v-model="formData"
          :loading="isLoading"
          :errors="errors"
          :api-error="apiError"
          :has-draft="hasDraft"
          :draft-saved-at="draftSavedAt"
          :draft-error="draftError"
          :is-draft-version-mismatch="isDraftVersionMismatch"
          :is-dirty="isDirty"
          submit-label="Tiếp"
          mobile-submit-label="Tiếp"
          cancel-label="Huỷ"
          mobile-cancel-label="Huỷ"
          show-handover
          @submit="onStepOneValid"
          @cancel="navigateTo('/contracts')"
          @restore-draft="restoreDraft"
          @clear-draft="clearDraft"
        />
      </section>

      <section v-else-if="currentStep === 2" class="rounded-xl border border-dark-border bg-dark-surface p-6">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-white">Người ở chung</p>
              <UiBadge v-if="pendingOccupants.length > 0" variant="accent">{{ pendingOccupants.length }}</UiBadge>
              <span class="text-xs text-muted italic">tuỳ chọn</span>
            </div>
            <p class="mt-0.5 text-xs text-muted">Thêm ngay hoặc thêm sau trên trang chi tiết.</p>
          </div>
          <UiButton v-if="!showOccupantForm" variant="secondary" size="sm" @click="showOccupantForm = true">
            Thêm người ở
          </UiButton>
        </div>

        <div class="rounded-xl border border-dark-border bg-dark-deep/30">
          <div v-if="showOccupantForm" class="border-b border-dark-border p-4">
            <ContractOccupantForm
              :available="true"
              :exclude-tenant-ids="excludeTenantIds"
              @submit="handleAddPendingOccupant"
              @cancel="showOccupantForm = false"
            />
          </div>

          <div v-if="pendingOccupants.length > 0">
            <div
              v-for="occupant in pendingOccupants"
              :key="occupant.tenant_id"
              class="flex items-center gap-3 border-b border-dark-border/50 px-4 py-3.5 last:border-0"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-full border border-cyan/20 bg-cyan/10">
                <span class="text-xs font-bold text-cyan">{{ occupant.tenantName.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-white">{{ occupant.tenantName }}</p>
                <p class="text-xs text-muted">Từ {{ fmtDate(occupant.move_in_date) }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  :class="occupant.billing_counted
                    ? 'border-cyan/20 bg-cyan/10 text-cyan'
                    : 'border-dark-border bg-dark-hover text-muted'"
                  class="rounded-full border px-2 py-0.5 text-xs font-medium"
                >
                  {{ occupant.billing_counted ? 'Tính tiền' : 'Không tính' }}
                </span>
                <UiButton variant="ghost" size="sm" @click="removePendingOccupant(occupant.tenant_id)">
                  Xoá
                </UiButton>
              </div>
            </div>
          </div>

          <div v-else-if="!showOccupantForm" class="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p class="text-sm font-medium text-white">Chưa có người ở chung</p>
            <p class="max-w-xs text-xs leading-relaxed text-muted">Có thể thêm sau khi hợp đồng được tạo.</p>
          </div>
        </div>

        <UiAlert v-if="occupantSubmitError" severity="warning" class="mt-3">
          {{ occupantSubmitError }}
        </UiAlert>

        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <UiButton variant="secondary" :disabled="isLoading" @click="currentStep = 1">Quay lại</UiButton>
          <UiButton :loading="isLoading" @click="createContract(formData)">Tạo hợp đồng</UiButton>
        </div>
      </section>

      <section v-else-if="currentStep === 3 && createdContractId" class="rounded-xl border border-dark-border bg-dark-surface p-6">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-white">Dịch vụ hàng tháng</p>
            <p class="mt-0.5 text-xs text-muted">Điều chỉnh nếu cần — đã sao chép từ cài đặt tòa nhà.</p>
          </div>
          <UiButton variant="primary" size="sm" @click="navigateTo(`/contracts/${createdContractId}`)">
            Xong
          </UiButton>
        </div>
        <div class="rounded-xl border border-dark-border bg-dark-deep/30 p-4">
          <ContractServicesTab
            :services="contractServices"
            :loading="servicesLoading"
            @update="updateService"
          />
        </div>
      </section>
    </div>
  </div>
</template>
