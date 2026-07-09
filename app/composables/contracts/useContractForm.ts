import { useDebounceFn } from '@vueuse/core'
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { contractCreateSchema, contractUpdateSchema } from '~/utils/validators/contracts'
import { getApiErrorMessage } from '~/utils/api-error'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'

const CONTRACT_DRAFT_VERSION = 1

type DraftKey =
  | { mode: 'create' }
  | { mode: 'edit'; id: MaybeRef<string | null | undefined> }
  | null

interface WizardDraftState {
  currentStep?: number
  pendingOccupants?: unknown[]
  selectedServices?: unknown[]
}

interface WizardDraftRefs {
  currentStep?: Ref<number>
  pendingOccupants?: Ref<unknown[]>
  selectedServices?: Ref<unknown[]>
}

interface UseContractFormOptions<T> {
  draftKey?: DraftKey
  formData?: Ref<T>
  initialSnapshot?: MaybeRef<T | null>
  wizardState?: WizardDraftRefs
}

interface ContractDraftEnvelope<T> {
  draftVersion: number
  savedAt: string
  data: T
  wizardState?: WizardDraftState
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  if (key.mode === 'create') return 'contract-form:create'
  return `contract-form:edit:${toValue(key.id) || 'unknown'}`
}

function safeReadDraft<T>(storageKey: string): ContractDraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as ContractDraftEnvelope<T>
  }
  catch {
    return null
  }
}

function safeWriteDraft<T>(storageKey: string, value: ContractDraftEnvelope<T>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }
  catch {
    // quota or disabled storage; ignore
  }
}

function safeClearDraft(storageKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  }
  catch {
    // ignore
  }
}

function readWizardState(options: UseContractFormOptions<unknown>): WizardDraftState | undefined {
  const wizardState: WizardDraftState = {}
  if (options.wizardState?.currentStep) wizardState.currentStep = options.wizardState.currentStep.value
  if (options.wizardState?.pendingOccupants) wizardState.pendingOccupants = options.wizardState.pendingOccupants.value
  if (options.wizardState?.selectedServices) wizardState.selectedServices = options.wizardState.selectedServices.value
  return Object.keys(wizardState).length > 0 ? wizardState : undefined
}

function applyWizardState(options: UseContractFormOptions<unknown>, wizardState?: WizardDraftState): void {
  if (!wizardState) return
  if (options.wizardState?.currentStep && typeof wizardState.currentStep === 'number') {
    options.wizardState.currentStep.value = wizardState.currentStep
  }
  if (options.wizardState?.pendingOccupants && Array.isArray(wizardState.pendingOccupants)) {
    options.wizardState.pendingOccupants.value = wizardState.pendingOccupants
  }
  if (options.wizardState?.selectedServices && Array.isArray(wizardState.selectedServices)) {
    options.wizardState.selectedServices.value = wizardState.selectedServices
  }
}

function serializeTrackedState<T>(formData: T | null | undefined, wizardState?: WizardDraftState): string {
  return JSON.stringify({ data: formData ?? null, wizardState: wizardState ?? null })
}

export function useContractForm<T = unknown>(options: UseContractFormOptions<T> = {}) {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)
  const isDraftHydrated = ref(typeof window !== 'undefined')
  const draftError = ref<string | null>(null)
  const draftVersionTick = ref(0)
  const restoredBaseline = ref<string | null>(null)
  const initialWizardState = readWizardState(options as UseContractFormOptions<unknown>)

  const storageKey = computed(() => options.draftKey ? buildStorageKey(options.draftKey) : null)

  const snapshotSerialized = computed(() => {
    if (restoredBaseline.value !== null) return restoredBaseline.value
    if (!options.formData || !options.initialSnapshot) return null
    return serializeTrackedState(toValue(options.initialSnapshot), initialWizardState)
  })

  const currentSerialized = computed(() => {
    if (!options.formData) return null
    return serializeTrackedState(options.formData.value, readWizardState(options as UseContractFormOptions<unknown>))
  })

  const isDirty = computed(() => {
    if (!options.formData) return false
    if (snapshotSerialized.value === null) return false
    return snapshotSerialized.value !== currentSerialized.value
  })

  const draftEnvelope = computed(() => {
    if (!isDraftHydrated.value) return null
    void draftVersionTick.value
    return storageKey.value ? safeReadDraft<T>(storageKey.value) : null
  })
  const hasDraft = computed(() => draftEnvelope.value !== null)
  const draftSavedAt = computed(() => draftEnvelope.value?.savedAt ?? '')
  const isDraftVersionMismatch = computed(() =>
    draftEnvelope.value !== null && draftEnvelope.value.draftVersion !== CONTRACT_DRAFT_VERSION,
  )

  function refreshDraft() {
    draftVersionTick.value++
  }

  if (isDraftHydrated.value) {
    refreshDraft()
  }

  onMounted(() => {
    isDraftHydrated.value = true
    refreshDraft()
  })

  if (options.formData) {
    const persist = useDebounceFn(() => {
      if (!options.formData || !storageKey.value) return
      if (!isDirty.value) return
      safeWriteDraft(storageKey.value, {
        draftVersion: CONTRACT_DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        data: options.formData.value,
        wizardState: readWizardState(options as UseContractFormOptions<unknown>),
      })
      refreshDraft()
    }, 500)

    watch(
      () => ({
        data: options.formData!.value,
        wizardState: readWizardState(options as UseContractFormOptions<unknown>),
      }),
      () => persist(),
      { deep: true },
    )
  }

  function restoreDraft(): T | null {
    draftError.value = null
    if (!storageKey.value) return null
    const draft = safeReadDraft<T>(storageKey.value)
    if (!draft) return null
    if (draft.draftVersion !== CONTRACT_DRAFT_VERSION) {
      draftError.value = 'Bản nháp cũ không tương thích — chỉ có thể xoá'
      return null
    }
    if (options.formData) options.formData.value = draft.data
    applyWizardState(options as UseContractFormOptions<unknown>, draft.wizardState)
    restoredBaseline.value = serializeTrackedState(draft.data, draft.wizardState)
    return draft.data
  }

  function clearDraft() {
    if (!storageKey.value) return
    safeClearDraft(storageKey.value)
    draftError.value = null
    refreshDraft()
  }

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: ContractCreateInput) {
    clearErrors()

    const result = contractCreateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const response = await $fetch<ApiSuccess<ContractWithDetails>>('/api/contracts', {
        method: 'POST',
        body: result.data,
      })
      clearDraft()
      return response.data
    }
    catch (e: unknown) {
      apiError.value = getApiErrorMessage(e)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: ContractUpdateInput) {
    clearErrors()

    const result = contractUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const response = await $fetch<ApiSuccess<ContractWithDetails>>(`/api/contracts/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      return response.data
    }
    catch (e: unknown) {
      apiError.value = getApiErrorMessage(e)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    errors,
    apiError,
    isDirty,
    hasDraft,
    draftSavedAt,
    draftError,
    isDraftVersionMismatch,
    restoreDraft,
    clearDraft,
    submitCreate,
    submitUpdate,
  }
}
