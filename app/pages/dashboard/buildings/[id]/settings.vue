<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { BuildingReadiness } from '~/types/building-contract-profile'
import type { InventoryItem } from '~/types/inventory'
import { countActiveFinanceRules, deriveAdvancedSteps, deriveSetupSteps, resolveStepHash } from '~/utils/building-setup-steps'
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string
const authStore = useAuthStore()
const toast = useToast()

const settingsSource = createBuildingSettingsSource(id, await useBuildingSettingsBootstrap(id))
provideBuildingSettingsSource(settingsSource)
const { settings, building, contractRows, assignedManagers } = settingsSource

const readiness = computed<BuildingReadiness>(() => settings.value?.readiness
  ?? { contract: { ready: false, missing: [] }, billing: { ready: false, missing: [] } })

// The page owns the template items so the closed step can still summarize them.
const inventoryTemplate = useInventoryTemplate(id)
const { items: inventoryItems } = inventoryTemplate
const { data: inventoryTemplateData } = await useFetch<ApiSuccess<InventoryItem[]>>(
  () => `/api/buildings/${encodeURIComponent(id)}/inventory-template`,
)
watchEffect(() => {
  inventoryItems.value = inventoryTemplateData.value?.data ?? []
})
const canEditInventoryTemplate = computed(() => authStore.can('buildings.update'))

const buildingServices = computed(() => settings.value?.buildingServices ?? [])

const setupFlow = computed(() => deriveSetupSteps({
  readiness: readiness.value,
  building: building.value
    ? {
        defaultElectricityRate: building.value.defaultElectricityRate,
        defaultWaterRate: building.value.defaultWaterRate,
        billingGenerationDay: building.value.billingGenerationDay,
        paymentDueDay: building.value.paymentDueDay,
      }
    : null,
  contractProfile: settings.value?.contractProfile
    ? {
        lessorFullName: settings.value.contractProfile.lessorFullName,
        lessorPhone: settings.value.contractProfile.lessorPhone,
        defaultTermMonths: settings.value.contractProfile.defaultTermMonths,
        defaultDepositMonths: settings.value.contractProfile.defaultDepositMonths,
      }
    : null,
  services: {
    activeCount: buildingServices.value.filter(service => service.isActive).length,
    unpricedActiveCount: buildingServices.value.filter(service => service.isActive && service.defaultAmount === 0).length,
  },
  inventory: {
    itemCount: inventoryItems.value.length,
    totalValue: inventoryItems.value.reduce((sum, item) => sum + item.quantity * (item.unitValue ?? 0), 0),
  },
  canViewContractProfile: authStore.can('building-contract-profile.read'),
  canViewInventory: authStore.can('rooms.read'),
}))

const canViewFinanceRules = computed(() =>
  authStore.can('building-fixed-costs.write')
  || authStore.can('reserve-fund.manage')
  || authStore.can('recurring-expenses.write')
  || authStore.can('prepaid-expenses.write'),
)

const advancedSteps = computed(() => deriveAdvancedSteps({
  buildingCode: building.value?.code ?? null,
  managerCount: authStore.canManageUsers ? assignedManagers.value.length : null,
  canViewFinanceRules: canViewFinanceRules.value,
  financeRuleCount: settings.value ? countActiveFinanceRules(settings.value) : 0,
  contractCount: contractRows.value.length,
}))

const openStepId = ref<string | null>(setupFlow.value.nextStepId)
const advancedOpenId = ref<string | null>(null)
const basicsDirty = ref(false)
// undefined = no pending switch; null = the user asked to close the open step.
const pendingStepId = ref<string | null | undefined>(undefined)

const { discardOpen, guardRouteLeave, keepEditing, discardChanges, onBeforeUnload } = usePortalUnsavedChanges(basicsDirty)
onBeforeRouteLeave(guardRouteLeave)

const discardModalOpen = computed(() => discardOpen.value || pendingStepId.value !== undefined)

function scrollToStep(stepId: string) {
  nextTick(() => document.getElementById(stepId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function requestOpenStep(next: string | null) {
  // Locked steps are never openable (hash links and old anchors can still ask for them).
  if (next !== null && setupFlow.value.steps.some(step => step.id === next && step.locked)) return
  if (basicsDirty.value && openStepId.value === 'basics' && next !== 'basics') {
    pendingStepId.value = next
    return
  }
  openStepId.value = next
}

function openStep(stepId: string) {
  requestOpenStep(stepId)
  scrollToStep(stepId)
}

const setupMode = useBuildingSetupMode({
  flow: setupFlow,
  openStep: (stepId) => {
    requestOpenStep(stepId)
    if (stepId) scrollToStep(stepId)
  },
})

const createContractPath = computed(() => {
  if (!building.value) return '/dashboard/contracts/create'
  const vacant = settings.value?.vacantRoomIds ?? []
  const base = `/dashboard/contracts/create?building_id=${encodeURIComponent(building.value.id)}`
  return vacant.length === 1 ? `${base}&room_id=${encodeURIComponent(vacant[0]!)}` : base
})

const canAddRooms = computed(() => building.value?.totalRooms === 0 && authStore.can('rooms.create'))

const hasRoomsWithoutInventory = computed(() =>
  inventoryItems.value.length > 0 && (settings.value?.roomIdsWithoutInventory ?? []).length > 0,
)

function onDiscardConfirm() {
  if (pendingStepId.value === undefined) {
    discardChanges()
    return
  }
  const next = pendingStepId.value
  pendingStepId.value = undefined
  basicsDirty.value = false
  openStepId.value = next
}

function onDiscardCancel() {
  if (pendingStepId.value === undefined) keepEditing()
  else pendingStepId.value = undefined
}

function applyHash() {
  const hash = resolveStepHash(route.hash?.slice(1) ?? '')
  if (!hash) return
  if (setupFlow.value.steps.some(step => step.id === hash)) {
    requestOpenStep(hash)
    scrollToStep(hash)
  }
  else if (advancedSteps.value.some(step => step.id === hash)) {
    advancedOpenId.value = hash
    scrollToStep(hash)
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  applyHash()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
watch(() => route.hash, applyHash)

async function handleBasicsSaved() {
  await settingsSource.refresh()
  basicsDirty.value = false
  toast.success('Đã lưu thông tin tòa nhà.')
  setupMode.afterSave('basics')
}

// Leave the step open while rooms still lack inventory so the apply suggestion stays visible.
function handleInventorySaved() {
  if (hasRoomsWithoutInventory.value) return
  setupMode.afterSave('inventory-template')
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      :title="setupMode.active.value ? 'Thiết lập tòa nhà' : 'Cài đặt tòa nhà'"
      :description="setupMode.active.value ? `${building?.name ?? ''} · Hoàn tất 4 bước bắt buộc để lập hợp đồng` : building?.name"
      :back-to="building ? buildingPath(building) : `/dashboard/buildings/${id}`"
      back-label="Quay lại tòa nhà"
    />

    <SettingsReadinessCard
      :flow="setupFlow"
      :setup-mode="setupMode.active.value"
      :create-contract-path="createContractPath"
      :building-path="building ? buildingPath(building) : undefined"
      :can-add-rooms="canAddRooms"
      :add-rooms-path="building ? `${buildingPath(building)}/rooms/batch` : undefined"
      @open-step="openStep"
      @exit-setup="setupMode.exit()"
    />

    <SettingsStepList :steps="setupFlow.steps" :open-id="openStepId" @update:open-id="requestOpenStep">
      <template #step-lessor-profile>
        <LessorProfileStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('lessor-profile')" />
      </template>
      <template #step-contract-terms>
        <ContractTermsStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('contract-terms')" />
      </template>
      <template #step-basics>
        <BasicsStep
          v-if="building"
          :building="building"
          :submit-label="setupMode.submitLabel.value"
          @saved="handleBasicsSaved"
          @cancel="requestOpenStep(null)"
          @update:dirty="basicsDirty = $event"
        />
      </template>
      <template #step-invoice-profile>
        <InvoiceProfileStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('invoice-profile')" />
      </template>
      <template #step-service-defaults>
        <ServicesStep />
        <div v-if="setupMode.active.value" class="flex justify-end">
          <UiButton size="sm" data-test="setup-services-next" @click="setupMode.skip('service-defaults')">Tiếp</UiButton>
        </div>
      </template>
      <template #step-inventory-template>
        <InventoryStep
          :template="inventoryTemplate"
          :building-id="building?.id ?? id"
          :can-edit="canEditInventoryTemplate"
          :submit-label="setupMode.submitLabel.value"
          @saved="handleInventorySaved"
        />
        <div v-if="setupMode.active.value" class="flex justify-end">
          <UiButton size="sm" variant="ghost" data-test="setup-inventory-skip" @click="setupMode.skip('inventory-template')">Bỏ qua</UiButton>
        </div>
      </template>
    </SettingsStepList>

    <AdvancedSection :steps="advancedSteps" :open-id="advancedOpenId" @update:open-id="advancedOpenId = $event" />

    <UiConfirmModal
      :open="discardModalOpen"
      title="Bỏ thay đổi chưa lưu?"
      message="Thông tin tòa nhà bạn vừa sửa chưa được lưu."
      confirm-label="Bỏ thay đổi"
      @confirm="onDiscardConfirm"
      @cancel="onDiscardCancel"
    />
  </div>
</template>
