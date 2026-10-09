<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractOccupant } from '~/types/contract-occupants'
import type { ContractOccupantAddInput, ContractOccupantMoveOutInput } from '~/utils/validators/contract-occupants'
import { getApiErrorMessage } from '~/utils/api-error'
import { formatViDate } from '~/utils/format/time'

const props = defineProps<{
  contract: ContractWithDetails
  occupants: ContractOccupant[]
  isLoading: boolean
  canManage: boolean
  addOccupant: (input: ContractOccupantAddInput) => Promise<ContractOccupant>
  moveOut: (id: string, input: ContractOccupantMoveOutInput) => Promise<void>
  removeOccupant: (id: string) => Promise<void>
}>()

const activeOccupantCount = computed(
  () => props.occupants.filter(o => !o.moveOutDate && o.role === 'roommate').length + 1,
)
const isOccupantLimitReached = computed(
  () => activeOccupantCount.value >= props.contract.occupantCount,
)

const showOccupantForm = ref(false)
const isAddingOccupant = ref(false)
const occupantApiError = ref<string | null>(null)

const moveOutOccupantId = ref<string | null>(null)
const moveOutDate = ref(new Date().toISOString().slice(0, 10))
const isMovingOut = ref(false)

const deletingOccupantId = ref<string | null>(null)
const isDeletingOccupant = ref(false)

async function handleAddOccupant(input: ContractOccupantAddInput) {
  isAddingOccupant.value = true
  occupantApiError.value = null
  try {
    await props.addOccupant(input)
    showOccupantForm.value = false
  }
  catch (err: unknown) {
    occupantApiError.value = getApiErrorMessage(err, 'Không thể thêm người ở. Vui lòng thử lại.')
  }
  finally {
    isAddingOccupant.value = false
  }
}

async function handleMoveOut() {
  if (!moveOutOccupantId.value) return
  isMovingOut.value = true
  try {
    await props.moveOut(moveOutOccupantId.value, { move_out_date: moveOutDate.value })
    moveOutOccupantId.value = null
  }
  catch {
    // keep modal open on error
  }
  finally {
    isMovingOut.value = false
  }
}

async function handleDeleteOccupant() {
  if (!deletingOccupantId.value) return
  isDeletingOccupant.value = true
  try {
    await props.removeOccupant(deletingOccupantId.value)
  }
  finally {
    isDeletingOccupant.value = false
    deletingOccupantId.value = null
  }
}
</script>

<template>
  <UiSection id="occupants" title="Người ở" class="mt-6 scroll-mt-20">
    <template #actions>
      <div class="flex items-center gap-2">
        <template v-if="!isLoading">
          <span
            :class="[
              'text-xs rounded px-1.5 py-0.5 border',
              isOccupantLimitReached
                ? 'text-status-warning border-status-warning/40'
                : 'text-ui-muted border-ui-border',
            ]"
            :title="isOccupantLimitReached ? 'Đã đạt số người tối đa của hợp đồng' : undefined"
          >
            {{ activeOccupantCount }}/{{ contract.occupantCount }}
          </span>
        </template>
        <UiButton
          v-if="canManage && !showOccupantForm"
          variant="secondary"
          size="sm"
          :disabled="isOccupantLimitReached"
          :title="isOccupantLimitReached ? 'Đã đạt số người tối đa. Cập nhật hợp đồng để tăng giới hạn.' : undefined"
          @click="showOccupantForm = true"
        >
          + Thêm người ở
        </UiButton>
      </div>
    </template>

    <!-- Add form -->
    <div v-if="showOccupantForm" class="mb-4 rounded-lg border border-ui-border p-4">
      <ContractOccupantForm
        :exclude-tenant-ids="[
          contract.tenantId,
          ...occupants.filter(o => !o.moveOutDate).map(o => o.tenantId),
        ]"
        :loading="isAddingOccupant"
        :api-error="occupantApiError"
        @submit="handleAddOccupant"
        @cancel="showOccupantForm = false; occupantApiError = null"
      />
    </div>

    <!-- Occupants: one grouped inset container, primary tenant first -->
    <div class="overflow-hidden rounded-xl border border-ui-border bg-ui-surface divide-y divide-ui-border">
      <NuxtLink
        v-if="contract.tenant"
        :to="`/dashboard/tenants/${contract.tenant.id}`"
        class="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover"
      >
        <div class="size-8 rounded-full bg-ui-accent/10 flex items-center justify-center shrink-0">
          <span class="text-ui-accent text-xs font-bold">{{ contract.tenant.fullName.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ui-primary group-hover:text-ui-accent transition-colors">{{ contract.tenant.fullName }}</p>
          <p class="text-xs text-ui-muted mt-0.5">{{ contract.tenant.phone }}</p>
        </div>
        <span class="text-xs text-ui-muted border border-ui-border rounded px-2 py-0.5 shrink-0">Người thuê chính</span>
        <IconChevronRight class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
      </NuxtLink>

      <!-- Roommate list -->
      <div v-if="isLoading" class="p-3">
        <UiSkeleton class="h-12 rounded-lg" />
      </div>
      <template v-else>
        <div
          v-for="occ in occupants.filter(o => o.role === 'roommate')"
          :key="occ.id"
          :class="['flex items-center gap-3 px-4 py-3', occ.moveOutDate && 'opacity-50']"
        >
          <div class="size-8 rounded-full bg-ui-deep flex items-center justify-center shrink-0">
            <span class="text-ui-muted text-xs font-bold">{{ occ.tenantName?.charAt(0).toUpperCase() ?? '?' }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ui-primary">{{ occ.tenantName ?? occ.tenantId.slice(0, 8) + '…' }}</p>
            <p class="text-xs text-ui-muted mt-0.5">
              <template v-if="occ.tenantPhone">{{ occ.tenantPhone }} · </template>
              Vào {{ formatViDate(occ.moveInDate) }}
              <template v-if="occ.moveOutDate">
                · Rời {{ formatViDate(occ.moveOutDate) }}
              </template>
            </p>
          </div>
          <template v-if="canManage">
            <UiButton
              v-if="!occ.moveOutDate"
              variant="ghost"
              size="sm"
              @click="moveOutOccupantId = occ.id; moveOutDate = new Date().toISOString().slice(0, 10)"
            >
              Ghi nhận rời
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              class="text-status-danger hover:text-status-danger"
              @click="deletingOccupantId = occ.id"
            >
              Xoá
            </UiButton>
          </template>
        </div>
        <p v-if="occupants.filter(o => o.role === 'roommate').length === 0 && !showOccupantForm" class="text-sm text-ui-muted text-center py-3">
          Chưa có người ở chung nào.
        </p>
      </template>
    </div>
  </UiSection>

  <!-- Move-out modal -->
  <div v-if="moveOutOccupantId" class="fixed inset-0 z-50 flex items-center justify-center bg-ui-overlay/60 p-4">
    <div class="w-full max-w-sm rounded-xl bg-ui-surface border border-ui-border p-6 space-y-4">
      <h2 class="text-sm font-semibold text-ui-primary">Ghi nhận ngày rời phòng</h2>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm text-ui-muted">Ngày rời</label>
        <UiDatePicker
          v-model="moveOutDate"
          date-mode="period-end"
          class="w-full"
        />
      </div>
      <div class="flex gap-2">
        <UiButton size="sm" :loading="isMovingOut" @click="handleMoveOut">Xác nhận</UiButton>
        <UiButton size="sm" variant="secondary" :disabled="isMovingOut" @click="moveOutOccupantId = null">Huỷ</UiButton>
      </div>
    </div>
  </div>

  <!-- Delete occupant modal -->
  <UiConfirmModal
    :open="!!deletingOccupantId"
    title="Xoá người ở"
    message="Bạn có chắc muốn xoá người ở này? Hành động này không thể hoàn tác."
    :loading="isDeletingOccupant"
    @confirm="handleDeleteOccupant"
    @cancel="deletingOccupantId = null"
  />
</template>
