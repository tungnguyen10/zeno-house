import { useDebounceFn } from '@vueuse/core'
import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import { tenantCreateSchema, tenantUpdateSchema } from '~/utils/validators/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { tenantPath } from '~/utils/routes/operational'

type DraftKey =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | null

interface UseTenantFormOptions<T> {
  draftKey?: DraftKey
  formData?: Ref<T>
  initialSnapshot?: MaybeRef<T | null>
}

interface TenantSubmitOptions {
  skipRedirect?: boolean
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  return key.mode === 'create'
    ? 'tenant-form:create'
    : `tenant-form:edit:${key.id}`
}

function safeReadDraft<T>(storageKey: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function safeWriteDraft<T>(storageKey: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }
  catch {
    // quota or disabled; ignore
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

export function useTenantForm<T = unknown>(options: UseTenantFormOptions<T> = {}) {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  const storageKey = options.draftKey ? buildStorageKey(options.draftKey) : null
  const hasDraft = ref(false)

  function refreshHasDraft() {
    if (!storageKey || typeof window === 'undefined') {
      hasDraft.value = false
      return
    }
    hasDraft.value = window.localStorage.getItem(storageKey) !== null
  }

  refreshHasDraft()

  onMounted(() => {
    refreshHasDraft()
  })

  const snapshotSerialized = computed(() =>
    options.initialSnapshot ? JSON.stringify(toValue(options.initialSnapshot) ?? null) : null,
  )

  const currentSerialized = computed(() =>
    options.formData ? JSON.stringify(options.formData.value ?? null) : null,
  )

  const isDirty = computed(() => {
    if (!options.formData) return false
    if (snapshotSerialized.value === null) return false
    return snapshotSerialized.value !== currentSerialized.value
  })

  if (storageKey && options.formData) {
    const persist = useDebounceFn(() => {
      if (!options.formData) return
      if (!isDirty.value) return
      safeWriteDraft(storageKey, options.formData.value)
      hasDraft.value = true
    }, 500)

    watch(() => options.formData!.value, () => {
      persist()
    }, { deep: true })
  }

  function restoreDraft(): T | null {
    if (!storageKey) return null
    const draft = safeReadDraft<T>(storageKey)
    if (draft === null) return null
    if (options.formData) options.formData.value = draft
    return draft
  }

  function clearDraft() {
    if (!storageKey) return
    safeClearDraft(storageKey)
    hasDraft.value = false
  }

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: TenantCreateInput, options: TenantSubmitOptions = {}): Promise<Tenant | null> {
    clearErrors()

    const result = tenantCreateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const res = await $fetch<ApiSuccess<Tenant>>('/api/tenants', {
        method: 'POST',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      if (!options.skipRedirect) {
        await navigateTo(res.data ? tenantPath(res.data) : '/tenants')
      }
      return res.data ?? null
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: TenantUpdateInput, options: TenantSubmitOptions = {}): Promise<Tenant | null> {
    clearErrors()

    const result = tenantUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const res = await $fetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      if (!options.skipRedirect) {
        await navigateTo(res.data ? tenantPath(res.data) : `/tenants/${id}`)
      }
      return res.data ?? null
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
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
    submitCreate,
    submitUpdate,
    isDirty,
    hasDraft,
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
