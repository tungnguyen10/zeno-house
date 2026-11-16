<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { BuildingReadiness } from '~/types/building-contract-profile'
import type { InventoryItem } from '~/types/inventory'
import { countActiveFinanceRules, deriveAdvancedSteps, deriveSetupSteps } from '~/utils/building-setup-steps'
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
  contractProfile: settings.value?.contractProfile ?? null,
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

function closeStep() {
  openStepId.value = null
}

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
  const hash = route.hash?.slice(1)
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
  closeStep()
  toast.success('Đã lưu thông tin tòa nhà.')
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Cài đặt tòa nhà"
      :description="building?.name"
      :back-to="building ? buildingPath(building) : `/dashboard/buildings/${id}`"
      back-label="Quay lại tòa nhà"
    />

    <SettingsReadinessCard
      :flow="setupFlow"
      create-contract-path="/dashboard/contracts/create"
      @open-step="openStep"
    />

    <SettingsStepList :steps="setupFlow.steps" :open-id="openStepId" @update:open-id="requestOpenStep">
      <template #step-basics>
        <BasicsStep
          v-if="building"
          :building="building"
          @saved="handleBasicsSaved"
          @cancel="requestOpenStep(null)"
          @update:dirty="basicsDirty = $event"
        />
      </template>
      <template #step-invoice-profile>
        <InvoiceProfileStep @saved="closeStep" />
      </template>
      <template #step-service-defaults>
        <ServicesStep />
      </template>
      <template #step-inventory-template>
        <InventoryStep
          :template="inventoryTemplate"
          :building-id="building?.id ?? id"
          :can-edit="canEditInventoryTemplate"
          @saved="closeStep"
        />
      </template>
      <template #step-contract-profile>
        <ContractStep @saved="closeStep" />
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
