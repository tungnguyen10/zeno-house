import { useDebounceFn } from '@vueuse/core'
import type { ApiSuccess } from '~/types/api'
import type { ContractCreateDraftInput } from '~/utils/validators/contract-create-draft'

// Legacy wizard draft keys (localStorage) replaced by the server draft.
const LEGACY_DRAFT_KEYS = ['contract-form:create']

export function useContractCreateDraft() {
  const payload = ref<ContractCreateDraftInput | null>(null)
  const saving = ref(false)
  const lastSavedAt = ref<string | null>(null)

  if (typeof window !== 'undefined') {
    for (const key of LEGACY_DRAFT_KEYS) {
      try { window.localStorage.removeItem(key) }
      catch { /* ignore */ }
    }
  }

  async function restore(): Promise<ContractCreateDraftInput | null> {
    try {
      const res = await apiFetch<ApiSuccess<ContractCreateDraftInput | null>>('/api/contracts/create-draft')
      payload.value = res.data ?? null
      return payload.value
    }
    catch {
      return null
    }
  }

  const flush = useDebounceFn(async (value: ContractCreateDraftInput) => {
    saving.value = true
    try {
      const res = await apiFetch<ApiSuccess<{ updatedAt: string }>>('/api/contracts/create-draft', {
        method: 'PUT',
        body: { payload: value },
      })
      lastSavedAt.value = res.data?.updatedAt ?? new Date().toISOString()
    }
    catch {
      // best-effort autosave; ignore transient failures
    }
    finally {
      saving.value = false
    }
  }, 1000)

  function schedule(value: ContractCreateDraftInput) {
    payload.value = value
    void flush(value)
  }

  async function clear(): Promise<void> {
    payload.value = null
    try {
      await apiFetch('/api/contracts/create-draft', { method: 'DELETE' })
    }
    catch {
      // ignore
    }
  }

  return { payload, restore, schedule, clear, saving, lastSavedAt }
}
