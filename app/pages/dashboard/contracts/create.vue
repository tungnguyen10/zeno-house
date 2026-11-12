<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import type { BuildingService } from '~/types/building-services'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractOccupantAddInput } from '~/utils/validators/contract-occupants'
import type { InventoryItemInput } from '~/utils/validators/inventory'
import type { VehicleRow } from '~/components/contracts/ContractVehiclesEditor.vue'
import type { ContractServiceRow } from '~/components/contracts/ContractServicesEditor.vue'
import { resolveRoomQuery } from '~/utils/contracts/resolve-room-query'
import { blockForField, type ContractCreateBlock } from '~/utils/contracts/contract-create-blocks'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'
import { computeDeposit, computeEndDate, loadPrefs, resolveDefaults, savePrefs } from '~/utils/contracts/prefill-defaults'
import type { ContractDocument, ContractDocumentReadiness } from '~/types/contract-documents'
import { checkContractDocumentReadiness, useContractDocuments } from '~/composables/contracts/useContractDocuments'

definePageMeta({ title: 'Thêm hợp đồng mới' })

const route = useRoute()
const authStore = useAuthStore()

interface PendingOccupant { tenant_id: string; tenantName: string; move_in_date: string; billing_counted: boolean }

const form = ref({
  room_id: '',
  tenant_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  monthly_rent: '',
  deposit: '',
  payment_due_day: '',
  occupant_count: '1',
  notes: '',
  handover_electricity_reading: '',
  handover_water_reading: '',
  handover_reading_date: '',
})
const occupants = ref<PendingOccupant[]>([])
const vehicles = ref<VehicleRow[]>([])
const services = ref<ContractServiceRow[]>([])
const servicesTouched = ref(false)
const inventory = ref<InventoryItemInput[]>([])
const showOccupantForm = ref(false)
const touched = new Set<string>()

const openBlocks = ref<Record<ContractCreateBlock, boolean>>({
  room: true, tenant: true, terms: true, handover: true,
  occupants: false, vehicles: false, services: false, inventory: false,
})
function toggleBlock(key: ContractCreateBlock) { openBlocks.value[key] = !openBlocks.value[key] }

const { errors, apiError, isLoading, submitCreate } = useContractForm()
const draft = useContractCreateDraft()
const createdContract = ref<ContractWithDetails | null>(null)

// DOCX readiness (PR4b): drives the primary button + post-create issue.
const documentsApi = useContractDocuments(() => createdContract.value?.id ?? '')
const docReadiness = ref<ContractDocumentReadiness | null>(null)
const issuedDoc = ref<ContractDocument | null>(null)
const issueError = ref<string | null>(null)

watch([() => form.value.room_id, () => form.value.tenant_id, occupants], async () => {
  if (!form.value.room_id || !form.value.tenant_id) { docReadiness.value = null; return }
  try {
    docReadiness.value = await checkContractDocumentReadiness({
      room_id: form.value.room_id,
      tenant_id: form.value.tenant_id,
      occupant_tenant_ids: occupants.value.map(o => o.tenant_id),
    })
  }
  catch { docReadiness.value = null }
}, { deep: true })

// Room options (available rooms); selecting one derives building + default rent.
const { data: roomsData } = useLazyFetch<ApiSuccess<Room[]> & { meta: unknown }>('/api/rooms', {
  query: { available: 'true', limit: 200 },
})
const roomOptions = computed(() => roomsData.value?.data ?? [])
const selectedRoom = computed(() => (roomsData.value?.data ?? []).find(r => r.id === form.value.room_id) ?? null)
const buildingId = computed(() => selectedRoom.value?.buildingId ?? null)

// Prefill rent + building-scoped defaults (prefs > building contract profile).
watch(buildingId, async (id) => {
  if (!id) return
  if (selectedRoom.value && !touched.has('monthly_rent')) form.value.monthly_rent = String(selectedRoom.value.monthlyRent)
  let buildingDefaults = { termMonths: null as number | null, depositMonths: null as number | null }
  try {
    const profile = await apiFetch<ApiSuccess<{ defaultTermMonths: number | null; defaultDepositMonths: number | null } | null>>(
      `/api/buildings/${id}/contract-profile`,
    )
    buildingDefaults = {
      termMonths: profile.data?.defaultTermMonths ?? null,
      depositMonths: profile.data?.defaultDepositMonths ?? null,
    }
  }
  catch { /* profile optional */ }
  const defaults = resolveDefaults(buildingDefaults, loadPrefs(id))
  if (defaults.termMonths != null && form.value.start_date && !touched.has('end_date')) {
    form.value.end_date = computeEndDate(form.value.start_date, defaults.termMonths)
  }
  const rent = Number(form.value.monthly_rent)
  if (defaults.depositMonths != null && rent > 0 && !touched.has('deposit')) {
    form.value.deposit = String(computeDeposit(rent, defaults.depositMonths))
  }
  // Prefill service + inventory blocks from the building/room.
  try {
    const svc = await apiFetch<ApiSuccess<BuildingService[]>>(`/api/building-services?building_id=${id}`)
    services.value = (svc.data ?? []).filter(s => s.isActive).map(s => ({
      catalog_id: s.catalogId, name: s.catalog.name, amount: s.defaultAmount, quantity: 1, is_enabled: true, notes: null,
    }))
  }
  catch { /* ignore */ }
})

watch(() => form.value.room_id, async (id) => {
  if (!id) return
  try {
    const inv = await apiFetch<ApiSuccess<{ name: string; quantity: number; condition: InventoryItemInput['condition']; unitValue: number | null; note: string | null }[]>>(`/api/rooms/${id}/inventory`)
    inventory.value = (inv.data ?? []).map(i => ({ name: i.name, quantity: i.quantity, condition: i.condition, unit_value: i.unitValue, note: i.note }))
  }
  catch { /* ignore */ }
})

const excludeTenantIds = computed(() => [form.value.tenant_id, ...occupants.value.map(o => o.tenant_id)].filter(Boolean))
const servicesChanged = computed(() => (servicesTouched.value ? services.value.filter(s => !s.is_enabled).length + 1 : 0))

function markTouched(field: string) { touched.add(field) }

function onServicesUpdate(rows: ContractServiceRow[]) { services.value = rows; servicesTouched.value = true }

function addPendingOccupant(input: ContractOccupantAddInput & { tenantName: string }) {
  occupants.value.push({ tenant_id: input.tenant_id, tenantName: input.tenantName || '-', move_in_date: input.move_in_date, billing_counted: input.billing_counted })
  showOccupantForm.value = false
}
function removePendingOccupant(tenantId: string) { occupants.value = occupants.value.filter(o => o.tenant_id !== tenantId) }

function openAndScrollTo(block: ContractCreateBlock) {
  openBlocks.value[block] = true
  nextTick(() => {
    const el = document.querySelector(`[data-block="${block}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function buildPayload() {
  return {
    room_id: form.value.room_id,
    tenant_id: form.value.tenant_id,
    start_date: form.value.start_date,
    end_date: form.value.end_date,
    monthly_rent: Number(form.value.monthly_rent),
    deposit: form.value.deposit ? Number(form.value.deposit) : 0,
    payment_due_day: form.value.payment_due_day ? Number(form.value.payment_due_day) : null,
    occupant_count: form.value.occupant_count ? Number(form.value.occupant_count) : 1,
    status: 'active' as const,
    notes: form.value.notes || null,
    handover_electricity_reading: Number(form.value.handover_electricity_reading),
    handover_water_reading: Number(form.value.handover_water_reading),
    handover_reading_date: form.value.handover_reading_date || undefined,
    occupants: occupants.value.map(o => ({ tenant_id: o.tenant_id, move_in_date: o.move_in_date, billing_counted: o.billing_counted })),
    vehicles: vehicles.value.length ? vehicles.value : undefined,
    services: servicesTouched.value
      ? services.value.map(s => ({ catalog_id: s.catalog_id, amount: s.amount, quantity: s.quantity, is_enabled: s.is_enabled, notes: s.notes }))
      : undefined,
    inventory: inventory.value,
  }
}

async function create(exportDocx: boolean) {
  const result = await submitCreate(buildPayload() as never)
  if (!result) {
    // Validation errors → open and scroll to the first offending block.
    const firstField = Object.keys(errors.value)[0]
    if (firstField) openAndScrollTo(blockForField(firstField))
    else if (apiError.value) {
      const code = getApiErrorCode(apiError.value)
      const reason = getApiErrorDetails<{ reason?: string }>(apiError.value)?.reason
      if (reason) openAndScrollTo(blockForField(reason))
      else if (code) openAndScrollTo(blockForField(code))
    }
    return
  }
  if (buildingId.value) {
    savePrefs(buildingId.value, {
      termMonths: undefined,
      depositMonths: undefined,
      paymentDueDay: form.value.payment_due_day ? Number(form.value.payment_due_day) : null,
      occupantCount: Number(form.value.occupant_count) || 1,
      openBlocks: Object.entries(openBlocks.value).filter(([, v]) => v).map(([k]) => k),
    })
  }
  await draft.clear()
  createdContract.value = result.contract
  // The contract is always created; DOCX issue is best-effort and never blocks it.
  if (exportDocx && docReadiness.value?.ready) {
    try {
      issuedDoc.value = await documentsApi.issue({ type: 'contract', signed_date: form.value.start_date })
    }
    catch (e) {
      issueError.value = getApiErrorMessage(e, 'Không thể xuất DOCX. Bạn có thể tạo lại ở trang hợp đồng.')
    }
  }
}

onMounted(async () => {
  // Prefill room from a room page link (uuid or code).
  const resolved = await resolveRoomQuery(route.query.room_id, async (code) => {
    const res = await apiFetch<ApiSuccess<{ id: string }>>(`/api/rooms/${encodeURIComponent(code)}`)
    return res.data
  })
  if (resolved && !form.value.room_id) form.value.room_id = resolved

  // Restore the server draft if present.
  const restored = await draft.restore()
  if (restored) {
    form.value = { ...form.value, ...restored, monthly_rent: restored.monthly_rent != null ? String(restored.monthly_rent) : form.value.monthly_rent, deposit: restored.deposit != null ? String(restored.deposit) : form.value.deposit } as typeof form.value
    if (restored.vehicles) vehicles.value = restored.vehicles as VehicleRow[]
    if (restored.inventory) inventory.value = restored.inventory
  }
})

// Autosave the server draft on change (debounced inside the composable).
watch([form, occupants, vehicles, services, inventory], () => {
  draft.schedule({
    room_id: form.value.room_id || undefined,
    tenant_id: form.value.tenant_id || undefined,
    start_date: form.value.start_date || undefined,
    end_date: form.value.end_date || undefined,
    monthly_rent: form.value.monthly_rent || undefined,
    deposit: form.value.deposit || undefined,
    occupant_count: Number(form.value.occupant_count) || undefined,
    notes: form.value.notes || undefined,
    occupants: occupants.value.map(o => ({ tenant_id: o.tenant_id, tenant_name: o.tenantName, move_in_date: o.move_in_date, billing_counted: o.billing_counted })),
    vehicles: vehicles.value.length ? vehicles.value : undefined,
    inventory: inventory.value.length ? inventory.value : undefined,
  } as never)
}, { deep: true })
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm hợp đồng mới"
      description="Chọn phòng, chọn khách, xác nhận điều khoản rồi tạo hợp đồng."
      :back-to="'/dashboard/contracts'"
      back-label="Danh sách hợp đồng"
    />

    <!-- Done screen -->
    <section v-if="createdContract" class="rounded-xl border border-ui-border bg-ui-surface p-6 text-center">
      <p class="text-base font-semibold text-ui-primary">Đã tạo hợp đồng {{ createdContract.contractCode }}</p>
      <p class="mt-1 text-sm text-ui-muted">Hợp đồng đã được tạo thành công.</p>
      <UiAlert v-if="issueError" severity="warning" class="mt-3 text-left">{{ issueError }}</UiAlert>
      <div class="mt-4 flex justify-center gap-2">
        <UiButton v-if="issuedDoc" variant="secondary" data-test="done-download" @click="documentsApi.download(issuedDoc.id)">
          Tải hợp đồng DOCX
        </UiButton>
        <NuxtLink :to="`/dashboard/contracts/${createdContract.contractCode}`">
          <UiButton variant="primary">Xem hợp đồng</UiButton>
        </NuxtLink>
      </div>
    </section>

    <div v-else class="space-y-4 pb-24">
      <UiAlert v-if="apiError" severity="danger">{{ apiError }}</UiAlert>

      <!-- Room -->
      <section data-block="room" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-ui-primary">Phòng</h2>
        <UiCombobox
          :model-value="selectedRoom"
          :options="roomOptions"
          :option-key="(r) => r.id"
          :option-label="(r) => r.roomNumber"
          label="Phòng cho thuê"
          placeholder="Chọn phòng trống"
          search-placeholder="Tìm số phòng..."
          :error="errors.room_id?.[0]"
          @update:model-value="(r) => form.room_id = r?.id ?? ''"
        />
      </section>

      <!-- Tenant -->
      <section data-block="tenant" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-ui-primary">Khách thuê</h2>
        <TenantPicker
          :model-value="form.tenant_id || null"
          :exclude-tenant-ids="occupants.map(o => o.tenant_id)"
          :error="errors.tenant_id?.[0]"
          required
          @update:model-value="(v) => form.tenant_id = v ?? ''"
        />
      </section>

      <!-- Terms -->
      <section data-block="terms" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-ui-primary">Điều khoản</h2>
        <p class="mb-3 text-xs text-ui-muted">Điều khoản áp dụng theo mẫu mặc định của tòa.</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UiInput :model-value="form.start_date" label="Ngày bắt đầu" type="date" :error="errors.start_date?.[0]" @update:model-value="(v) => { form.start_date = v; markTouched('start_date') }" />
          <UiInput :model-value="form.end_date" label="Ngày kết thúc" type="date" :error="errors.end_date?.[0]" @update:model-value="(v) => { form.end_date = v; markTouched('end_date') }" />
          <UiInput :model-value="form.monthly_rent" label="Giá thuê (đ)" type="number" number-mode="currency" :error="errors.monthly_rent?.[0]" @update:model-value="(v) => { form.monthly_rent = v; markTouched('monthly_rent') }" />
          <UiInput :model-value="form.deposit" label="Tiền cọc (đ)" type="number" number-mode="currency" @update:model-value="(v) => { form.deposit = v; markTouched('deposit') }" />
          <UiInput :model-value="form.payment_due_day" label="Ngày đến hạn (tùy chọn)" type="number" number-mode="integer" @update:model-value="(v) => form.payment_due_day = v" />
          <UiInput :model-value="form.occupant_count" label="Số người ở" type="number" number-mode="integer" @update:model-value="(v) => form.occupant_count = v" />
        </div>
        <UiTextarea :model-value="form.notes" label="Ghi chú" class="mt-3" @update:model-value="(v) => form.notes = v" />
      </section>

      <!-- Handover -->
      <section data-block="handover" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-ui-primary">Chỉ số bàn giao</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UiInput :model-value="form.handover_electricity_reading" label="Chỉ số điện" type="number" :error="errors.handover_electricity_reading?.[0]" @update:model-value="(v) => form.handover_electricity_reading = v" />
          <UiInput :model-value="form.handover_water_reading" label="Chỉ số nước" type="number" :error="errors.handover_water_reading?.[0]" @update:model-value="(v) => form.handover_water_reading = v" />
          <UiInput :model-value="form.handover_reading_date" label="Ngày đọc" type="date" @update:model-value="(v) => form.handover_reading_date = v" />
        </div>
      </section>

      <!-- Occupants (collapsible) -->
      <section data-block="occupants" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <button type="button" class="flex w-full items-center justify-between" @click="toggleBlock('occupants')">
          <span class="text-sm font-semibold text-ui-primary">Người ở cùng<span v-if="occupants.length"> · {{ occupants.length }}</span></span>
          <span class="text-xs text-ui-muted">{{ openBlocks.occupants ? 'Thu gọn' : 'Mở' }}</span>
        </button>
        <div v-show="openBlocks.occupants" class="mt-3 space-y-2">
          <div v-for="o in occupants" :key="o.tenant_id" class="flex items-center justify-between rounded-lg border border-ui-border px-3 py-2">
            <span class="text-sm text-ui-primary">{{ o.tenantName }}</span>
            <UiButton variant="ghost" size="sm" @click="removePendingOccupant(o.tenant_id)">Xoá</UiButton>
          </div>
          <ContractOccupantForm v-if="showOccupantForm" :exclude-tenant-ids="excludeTenantIds" @submit="addPendingOccupant" @cancel="showOccupantForm = false" />
          <UiButton v-else variant="secondary" size="sm" @click="showOccupantForm = true">Thêm người ở</UiButton>
        </div>
      </section>

      <!-- Vehicles (collapsible) -->
      <section data-block="vehicles" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <button type="button" class="flex w-full items-center justify-between" @click="toggleBlock('vehicles')">
          <span class="text-sm font-semibold text-ui-primary">Xe<span v-if="vehicles.length"> · {{ vehicles.length }}</span></span>
          <span class="text-xs text-ui-muted">{{ openBlocks.vehicles ? 'Thu gọn' : 'Mở' }}</span>
        </button>
        <div v-show="openBlocks.vehicles" class="mt-3">
          <ContractVehiclesEditor v-model="vehicles" />
        </div>
      </section>

      <!-- Services (collapsible) -->
      <section data-block="services" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <button type="button" class="flex w-full items-center justify-between" @click="toggleBlock('services')">
          <span class="text-sm font-semibold text-ui-primary">Dịch vụ<span v-if="servicesChanged"> · {{ servicesChanged }} thay đổi</span></span>
          <span class="text-xs text-ui-muted">{{ openBlocks.services ? 'Thu gọn' : 'Mở' }}</span>
        </button>
        <div v-show="openBlocks.services" class="mt-3">
          <ContractServicesEditor :model-value="services" @update:model-value="onServicesUpdate" />
        </div>
      </section>

      <!-- Inventory (collapsible) -->
      <section data-block="inventory" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <button type="button" class="flex w-full items-center justify-between" @click="toggleBlock('inventory')">
          <span class="text-sm font-semibold text-ui-primary">Nội thất<span v-if="inventory.length"> · {{ inventory.length }} món</span></span>
          <span class="text-xs text-ui-muted">{{ openBlocks.inventory ? 'Thu gọn' : 'Mở' }}</span>
        </button>
        <div v-show="openBlocks.inventory" class="mt-3">
          <InventoryItemsEditor v-model="inventory" />
        </div>
      </section>

      <!-- DOCX readiness hint: contract can still be created without the document. -->
      <UiAlert v-if="docReadiness && !docReadiness.ready" severity="info" data-test="docx-missing">
        Chưa đủ dữ liệu để xuất hợp đồng DOCX: {{ docReadiness.missing.map(m => m.label).join(', ') }}. Vẫn có thể tạo hợp đồng.
      </UiAlert>

      <!-- Sticky action bar -->
      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-ui-border bg-ui-surface/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div class="mx-auto flex max-w-3xl justify-end gap-2">
          <UiButton variant="secondary" :disabled="isLoading" @click="navigateTo('/dashboard/contracts')">Huỷ</UiButton>
          <UiButton variant="secondary" :loading="isLoading" @click="create(false)">Tạo hợp đồng</UiButton>
          <UiButton
            v-if="authStore.can('contract-documents.issue') && docReadiness?.ready !== false"
            variant="primary"
            :loading="isLoading"
            data-test="create-and-export"
            @click="create(true)"
          >
            Tạo &amp; xuất DOCX
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
