<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
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
import { createLatestGuard } from '~/utils/contracts/latest-guard'
import type { ContractDocument, ContractDocumentReadiness } from '~/types/contract-documents'
import { checkContractDocumentReadiness, useContractDocuments } from '~/composables/contracts/useContractDocuments'

definePageMeta({ title: 'Thêm hợp đồng mới' })

const route = useRoute()
const buildingFilter = ref(typeof route.query.building_id === 'string' ? route.query.building_id : '')
const authStore = useAuthStore()

// The docked action bar owns the bottom of the mobile viewport, so the tab bar steps aside.
const formMode = useAppFormMode()
onMounted(() => { formMode.value = true })
onBeforeUnmount(() => { formMode.value = false })
interface PendingOccupant { tenant_id: string; tenantName: string; move_in_date: string; billing_counted: boolean; link_token?: string }

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
// Verification tokens live in page memory only; never in the server draft.
const tenantLinkToken = ref<string | null>(null)
const vehicles = ref<VehicleRow[]>([])
const services = ref<ContractServiceRow[]>([])
const servicesTouched = ref(false)
const inventory = ref<InventoryItemInput[]>([])
const showOccupantForm = ref(false)
const touched = new Set<string>()
let skipInventoryPrefill = false
const draftReady = ref(false)

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

const readinessGuard = createLatestGuard()
watch([() => form.value.room_id, () => form.value.tenant_id, occupants], async () => {
  const isLatest = readinessGuard()
  if (!form.value.room_id || !form.value.tenant_id) { docReadiness.value = null; return }
  try {
    const result = await checkContractDocumentReadiness({
      room_id: form.value.room_id,
      tenant_id: form.value.tenant_id,
      occupant_tenant_ids: occupants.value.map(o => o.tenant_id),
    })
    if (isLatest()) docReadiness.value = result
  }
  catch { if (isLatest()) docReadiness.value = null }
}, { deep: true })

// Room options (available rooms); typing searches on the server so large buildings are not truncated.
const roomSearch = ref('')
const { data: roomsData, status: roomsStatus } = useLazyFetch<ApiSuccess<Room[]> & { meta: unknown }>('/api/rooms', {
  query: computed(() => ({
    available: 'true',
    limit: 200,
    ...(roomSearch.value ? { q: roomSearch.value } : {}),
    ...(buildingFilter.value ? { building_id: buildingFilter.value } : {}),
  })),
})
const onRoomSearch = useDebounceFn((value: string) => { roomSearch.value = value.trim() }, 250)
const roomOptions = computed(() => roomsData.value?.data ?? [])
// Keeps the chosen room resolvable after a search narrows the option list.
const pickedRoom = ref<Room | null>(null)
const selectedRoom = computed(() =>
  roomOptions.value.find(r => r.id === form.value.room_id)
  ?? (pickedRoom.value?.id === form.value.room_id ? pickedRoom.value : null),
)
const buildingId = computed(() => selectedRoom.value?.buildingId ?? null)
function onRoomPicked(room: Room | null) {
  pickedRoom.value = room
  form.value.room_id = room?.id ?? ''
}

// A room restored from a link or draft may fall outside the loaded options.
watch([() => form.value.room_id, roomsStatus], async ([id, loadState]) => {
  if (!id || loadState !== 'success' || selectedRoom.value) return
  try {
    const res = await apiFetch<ApiSuccess<Room>>(`/api/rooms/${encodeURIComponent(id)}`)
    if (form.value.room_id === id) pickedRoom.value = res.data
  }
  catch { /* the room stays unresolved; the user can pick again */ }
})

// Prefill rent + building-scoped defaults (prefs > building contract profile).
const prefillGuard = createLatestGuard()
let loadedBuildingId: string | null = null
let buildingDefaults = { termMonths: null as number | null, depositMonths: null as number | null }
watch(() => [buildingId.value, selectedRoom.value?.id] as const, async ([id]) => {
  if (!id) return
  const isLatest = prefillGuard()
  if (selectedRoom.value && !touched.has('monthly_rent')) form.value.monthly_rent = String(selectedRoom.value.monthlyRent)
  if (loadedBuildingId !== id) {
    // Each request is optional: a failure falls back to manual entry.
    const [profile, svc] = await Promise.all([
      apiFetch<ApiSuccess<{ defaultTermMonths: number | null; defaultDepositMonths: number | null } | null>>(`/api/buildings/${id}/contract-profile`).catch(() => null),
      apiFetch<ApiSuccess<BuildingService[]>>(`/api/building-services?building_id=${id}`).catch(() => null),
    ])
    if (!isLatest()) return
    loadedBuildingId = id
    buildingDefaults = { termMonths: profile?.data?.defaultTermMonths ?? null, depositMonths: profile?.data?.defaultDepositMonths ?? null }
    if (svc) {
      services.value = (svc.data ?? []).filter(s => s.isActive).map(s => ({
        catalog_id: s.catalogId, name: s.catalog.name, amount: s.defaultAmount, quantity: 1, is_enabled: true, notes: null,
      }))
    }
  }
  const defaults = resolveDefaults(buildingDefaults, loadPrefs(id))
  if (defaults.termMonths != null && form.value.start_date && !touched.has('end_date')) {
    form.value.end_date = computeEndDate(form.value.start_date, defaults.termMonths)
  }
  const rent = Number(form.value.monthly_rent)
  if (defaults.depositMonths != null && rent > 0 && !touched.has('deposit')) {
    form.value.deposit = String(computeDeposit(rent, defaults.depositMonths))
  }
})

const readingsGuard = createLatestGuard()
watch(() => form.value.room_id, async (id) => {
  if (!id) return
  const isLatest = readingsGuard()
  try {
    const latest = await apiFetch<ApiSuccess<{ electricity: { readingValue: number } | null; water: { readingValue: number } | null }>>(
      '/api/meter-readings/latest', { query: { room_id: id } },
    )
    if (!isLatest()) return
    if (form.value.handover_electricity_reading === '' && latest.data?.electricity) form.value.handover_electricity_reading = String(latest.data.electricity.readingValue)
    if (form.value.handover_water_reading === '' && latest.data?.water) form.value.handover_water_reading = String(latest.data.water.readingValue)
  }
  catch { /* readings stay manual */ }
})

const inventoryGuard = createLatestGuard()
watch(() => form.value.room_id, async (id) => {
  if (!id) return
  if (skipInventoryPrefill) { skipInventoryPrefill = false; return }
  const isLatest = inventoryGuard()
  try {
    const inv = await apiFetch<ApiSuccess<{ name: string; quantity: number; condition: InventoryItemInput['condition']; unitValue: number | null; note: string | null }[]>>(`/api/rooms/${id}/inventory`)
    if (!isLatest()) return
    inventory.value = (inv.data ?? []).map(i => ({ name: i.name, quantity: i.quantity, condition: i.condition, unit_value: i.unitValue, note: i.note }))
  }
  catch { /* ignore */ }
})

const excludeTenantIds = computed(() => [form.value.tenant_id, ...occupants.value.map(o => o.tenant_id)].filter(Boolean))
const servicesChanged = computed(() => (servicesTouched.value ? services.value.filter(s => !s.is_enabled).length + 1 : 0))

function markTouched(field: string) { touched.add(field) }

function onServicesUpdate(rows: ContractServiceRow[]) { services.value = rows; servicesTouched.value = true }

function addPendingOccupant(input: ContractOccupantAddInput & { tenantName: string }) {
  occupants.value.push({ tenant_id: input.tenant_id, tenantName: input.tenantName || '-', move_in_date: input.move_in_date, billing_counted: input.billing_counted, link_token: input.link_token })
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
    tenant_link_token: tenantLinkToken.value || undefined,
    start_date: form.value.start_date,
    end_date: form.value.end_date,
    monthly_rent: Number(form.value.monthly_rent),
    deposit: form.value.deposit ? Number(form.value.deposit) : 0,
    payment_due_day: form.value.payment_due_day ? Number(form.value.payment_due_day) : null,
    occupant_count: form.value.occupant_count ? Number(form.value.occupant_count) : 1,
    status: 'active' as const,
    notes: form.value.notes || null,
    handover_electricity_reading: form.value.handover_electricity_reading === '' ? undefined : Number(form.value.handover_electricity_reading),
    handover_water_reading: form.value.handover_water_reading === '' ? undefined : Number(form.value.handover_water_reading),
    handover_reading_date: form.value.handover_reading_date || undefined,
    occupants: occupants.value.map(o => ({ tenant_id: o.tenant_id, move_in_date: o.move_in_date, billing_counted: o.billing_counted, ...(o.link_token ? { link_token: o.link_token } : {}) })),
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
    const { occupants: draftOccupants, vehicles: draftVehicles, inventory: draftInventory, services: _draftServices, ...fields } = restored
    form.value = { ...form.value, ...fields, monthly_rent: restored.monthly_rent != null ? String(restored.monthly_rent) : form.value.monthly_rent, deposit: restored.deposit != null ? String(restored.deposit) : form.value.deposit, occupant_count: restored.occupant_count != null ? String(restored.occupant_count) : form.value.occupant_count } as typeof form.value
    if (draftVehicles) vehicles.value = draftVehicles as VehicleRow[]
    if (draftInventory) {
      inventory.value = draftInventory
      skipInventoryPrefill = true
    }
    for (const key of ['monthly_rent', 'deposit', 'end_date'] as const) {
      if (fields[key] != null && fields[key] !== '') touched.add(key)
    }
    if (draftOccupants?.length) {
      occupants.value = draftOccupants.flatMap(o => (o.tenant_id
        ? [{ tenant_id: o.tenant_id, tenantName: o.tenant_name || '-', move_in_date: o.move_in_date ?? form.value.start_date, billing_counted: o.billing_counted ?? true }]
        : []))
    }
  }
  await nextTick()
  draftReady.value = true
})

// Autosave the server draft on change (debounced inside the composable).
watch([form, occupants, vehicles, services, inventory], () => {
  // An empty form (or one still restoring) must never overwrite a saved draft.
  if (!draftReady.value || (!form.value.room_id && !form.value.tenant_id)) return
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
          remote-search
          :error="errors.room_id?.[0]"
          @search="onRoomSearch"
          @update:model-value="onRoomPicked"
        />
        <button
          v-if="buildingFilter"
          type="button"
          class="mt-2 inline-flex min-h-9 items-center text-xs text-ui-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
          @click="buildingFilter = ''"
        >
          Xem phòng của mọi tòa
        </button>
      </section>

      <!-- Tenant -->
      <section data-block="tenant" class="rounded-xl border border-ui-border bg-ui-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-ui-primary">Khách thuê</h2>
        <TenantPicker
          :model-value="form.tenant_id || null"
          :exclude-tenant-ids="occupants.map(o => o.tenant_id)"
          :building-id="buildingId"
          :error="errors.tenant_id?.[0]"
          required
          @update:model-value="(v) => form.tenant_id = v ?? ''"
          @update:link-token="(t) => tenantLinkToken = t"
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
          <ContractOccupantForm v-if="showOccupantForm" :exclude-tenant-ids="excludeTenantIds" :building-id="buildingId" @submit="addPendingOccupant" @cancel="showOccupantForm = false" />
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
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-ui-border bg-ui-chrome/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
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
