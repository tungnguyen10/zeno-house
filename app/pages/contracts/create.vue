<script setup lang="ts">
import type { ContractFormData } from '~/components/contracts/ContractForm.vue'
import type { ContractOccupantAddInput } from '~/utils/validators/contract-occupants'
import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Thêm hợp đồng mới' })

const route = useRoute()
const { isLoading, errors, apiError, submitCreate } = useContractForm()

// Created contract id — used for Step 3 (services)
const createdContractId = ref<string | null>(null)
const { services: contractServices, isLoading: servicesLoading, updateService } = useContractServices(
  computed(() => createdContractId.value ?? ''),
)

const formData = ref<ContractFormData>({
  room_id: (route.query.room_id as string) || '',
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

// ─── Pending occupants (local, submitted after contract is created) ──────────
interface PendingOccupant {
  tenant_id: string
  tenantName: string
  move_in_date: string
  billing_counted: boolean
}

const pendingOccupants = ref<PendingOccupant[]>([])
const showOccupantForm = ref(false)
const occupantSubmitError = ref<string | null>(null)

// Used only for name resolution after form emits tenant_id
const { data: allTenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: { limit: 200, available: true },
})
const allTenants = computed(() => allTenantsData.value?.data ?? [])

const excludeTenantIds = computed(() =>
  [formData.value.tenant_id, ...pendingOccupants.value.map(o => o.tenant_id)].filter(Boolean),
)

function handleAddPendingOccupant(input: ContractOccupantAddInput) {
  const tenant = allTenants.value.find(t => t.id === input.tenant_id)
  pendingOccupants.value.push({
    tenant_id: input.tenant_id,
    tenantName: tenant?.fullName ?? '—',
    move_in_date: input.move_in_date,
    billing_counted: input.billing_counted,
  })
  showOccupantForm.value = false
}

function removePendingOccupant(tenantId: string) {
  pendingOccupants.value = pendingOccupants.value.filter(o => o.tenant_id !== tenantId)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Submit ──────────────────────────────────────────────────────────────────
async function onSubmit(data: ContractFormData) {
  occupantSubmitError.value = null
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
  if (!created) return

  if (pendingOccupants.value.length > 0) {
    const results = await Promise.allSettled(
      pendingOccupants.value.map(o =>
        $fetch(`/api/contracts/${created.id}/occupants`, {
          method: 'POST',
          body: { tenant_id: o.tenant_id, role: 'roommate', move_in_date: o.move_in_date, billing_counted: o.billing_counted },
        }),
      ),
    )
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) {
      occupantSubmitError.value = `${failed} người ở chưa thêm được — vui lòng thêm thủ công trên trang chi tiết.`
    }
  }

  // Show Step 3 — services
  createdContractId.value = created.id
}
</script>

<template>
  <div class="max-w-2xl">
    <!-- Page header -->
    <div class="mb-8">
      <NuxtLink
        to="/contracts"
        class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors"
      >
        <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 3L5 8l5 5" />
        </svg>
        Danh sách hợp đồng
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm hợp đồng mới</h1>
    </div>

    <!-- ── Two-step layout ──────────────────────────────────────────────── -->
    <div>

      <!-- Step 1 — Contract info -->
      <div class="flex gap-5">
        <!-- Step indicator + connector line -->
        <div class="flex flex-col items-center shrink-0">
          <div class="size-10 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center">
            <span class="text-cyan text-sm font-semibold">1</span>
          </div>
          <!-- Grows to fill the height of the content beside it -->
          <div class="w-px flex-1 bg-dark-border mt-2" />
        </div>

        <!-- Content -->
        <div class="flex-1 pb-8">
          <div class="mb-4">
            <p class="text-sm font-semibold text-white">Thông tin hợp đồng</p>
            <p class="text-xs text-muted mt-0.5">Phòng, khách thuê và điều khoản tài chính</p>
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
      </div>

      <!-- Step 2 — Occupants -->
      <div class="flex gap-5">
        <div class="flex flex-col items-center shrink-0">
          <div class="size-10 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center">
            <span class="text-muted text-sm font-semibold">2</span>
          </div>
        </div>

        <div class="flex-1">
          <!-- Section header -->
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-white">Người ở chung</p>
                <span
                  v-if="pendingOccupants.length > 0"
                  class="inline-flex items-center justify-center size-5 rounded-full bg-cyan/10 text-cyan border border-cyan/20 text-xs font-semibold leading-none"
                >{{ pendingOccupants.length }}</span>
                <span class="text-xs text-muted italic">tuỳ chọn</span>
              </div>
              <p class="text-xs text-muted mt-0.5">Thêm ngay — hoặc thêm sau trên trang chi tiết</p>
            </div>
            <UiButton
              v-if="!showOccupantForm"
              variant="secondary"
              size="sm"
              @click="showOccupantForm = true"
            >
              + Thêm người ở
            </UiButton>
          </div>

          <!-- Card -->
          <div class="rounded-xl border border-dark-border bg-dark-surface overflow-hidden">

            <!-- Inline add form -->
            <div v-if="showOccupantForm" class="p-4 border-b border-dark-border">
              <ContractOccupantForm
                :available="true"
                :exclude-tenant-ids="excludeTenantIds"
                @submit="handleAddPendingOccupant"
                @cancel="showOccupantForm = false"
              />
            </div>

            <!-- Pending list -->
            <div v-if="pendingOccupants.length > 0">
              <div
                v-for="occ in pendingOccupants"
                :key="occ.tenant_id"
                class="flex items-center gap-3 px-4 py-3.5 border-b border-dark-border/50 last:border-0"
              >
                <!-- Avatar -->
                <div class="size-8 rounded-full bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
                  <span class="text-cyan text-xs font-bold">{{ occ.tenantName.charAt(0).toUpperCase() }}</span>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate">{{ occ.tenantName }}</p>
                  <p class="text-xs text-muted">Từ {{ fmtDate(occ.move_in_date) }}</p>
                </div>

                <!-- Billing badge + remove -->
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    :class="occ.billing_counted
                      ? 'text-cyan bg-cyan/10 border-cyan/20'
                      : 'text-muted bg-dark-hover border-dark-border'"
                    class="text-xs border rounded-full px-2 py-0.5 font-medium"
                  >{{ occ.billing_counted ? 'Tính tiền' : 'Không tính' }}</span>
                  <button
                    type="button"
                    class="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Xoá"
                    @click="removePendingOccupant(occ.tenant_id)"
                  >
                    <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M2 2l12 12M14 2L2 14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="!showOccupantForm" class="flex flex-col items-center gap-2 py-10 px-4 text-center">
              <div class="size-10 rounded-full bg-dark-hover flex items-center justify-center mb-1">
                <svg class="size-5 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <p class="text-sm font-medium text-white">Chưa có người ở chung</p>
              <p class="text-xs text-muted max-w-xs leading-relaxed">Có thể thêm sau khi hợp đồng được tạo.</p>
            </div>
          </div>

          <!-- Error banner (occupant post-submit failure) -->
          <div
            v-if="occupantSubmitError"
            class="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3"
          >
            <svg class="size-4 text-amber-400 shrink-0 mt-px" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <p class="text-sm text-amber-400">{{ occupantSubmitError }}</p>
          </div>
        </div>
      </div>

      <!-- Step 3 — Services (appears after contract is created) -->
      <div v-if="createdContractId" class="flex gap-5 mt-0">
        <div class="flex flex-col items-center shrink-0">
          <div class="w-px h-6 bg-dark-border" />
          <div class="size-10 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center">
            <span class="text-cyan text-sm font-semibold">3</span>
          </div>
        </div>

        <div class="flex-1 pt-6 pb-8">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">Dịch vụ hàng tháng</p>
              <p class="text-xs text-muted mt-0.5">Điều chỉnh nếu cần — đã sao chép từ cài đặt tòa nhà</p>
            </div>
            <UiButton
              variant="primary"
              size="sm"
              @click="navigateTo(`/contracts/${createdContractId}`)"
            >
              Xong →
            </UiButton>
          </div>
          <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
            <ContractServicesTab
              :services="contractServices"
              :loading="servicesLoading"
              @update="updateService"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
