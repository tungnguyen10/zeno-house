import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import {
  computed,
  isRef,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  reactive,
  readonly,
  ref,
  shallowRef,
  toRaw,
  toRef,
  toRefs,
  toValue,
  unref,
  useId,
  watch,
  watchEffect,
} from 'vue'
import { useBulkSelection } from '~/composables/useBulkSelection'
import UiButton from '~/components/ui/UiButton.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'

config.global.components = {
  ...config.global.components,
  UiButton,
  UiCheckbox,
}

// Nuxt auto-imports these into Vue SFCs at build-time. In vitest we don't run
// the Nuxt build, so we expose the same identifiers on globalThis. Components
// that import explicitly are unaffected (the import wins over the global).
for (const [name, fn] of Object.entries({
  computed, isRef, nextTick, onBeforeMount, onBeforeUnmount, onMounted, onUnmounted,
  reactive, readonly, ref, shallowRef, toRaw, toRef, toRefs, toValue, unref, useId, watch, watchEffect,
  useBulkSelection,
})) {
  vi.stubGlobal(name, fn)
}

function appError(statusCode: number, code: string, message: string, details?: unknown): Error {
  const error = new Error(message) as Error & { statusCode: number; data: unknown }
  error.statusCode = statusCode
  error.data = { error: { code, message, details } }
  return error
}

vi.stubGlobal('createError', (input: { statusCode?: number; message?: string; data?: unknown }) => {
  const error = new Error(input.message ?? 'Error') as Error & { statusCode?: number; data?: unknown }
  error.statusCode = input.statusCode
  error.data = input.data
  return error
})

vi.stubGlobal('throwConflict', (message = 'Conflict') => {
  throw appError(409, 'CONFLICT', message)
})

vi.stubGlobal('throwValidationError', (message = 'Validation error', details?: unknown) => {
  throw appError(422, 'VALIDATION_ERROR', message, details)
})

vi.stubGlobal('throwForbidden', (message = 'Forbidden') => {
  throw appError(403, 'FORBIDDEN', message)
})

vi.stubGlobal('throwNotFound', (message = 'Not found') => {
  throw appError(404, 'NOT_FOUND', message)
})

vi.stubGlobal('can', () => true)

// Role helpers are auto-imported in server code (server/utils/roles.ts). Provide
// real implementations here so server code under test resolves roles correctly.
function roleOfStub(user: { app_metadata?: { role?: string | null } | null } | null | undefined): string | null {
  return user?.app_metadata?.role ?? null
}
vi.stubGlobal('roleOf', roleOfStub)
vi.stubGlobal('isAdmin', (u: never) => roleOfStub(u) === 'admin')
vi.stubGlobal('isOwner', (u: never) => roleOfStub(u) === 'owner')
vi.stubGlobal('isManager', (u: never) => roleOfStub(u) === 'manager')
vi.stubGlobal('isScopedRole', (u: never) => {
  const r = roleOfStub(u)
  return r === 'owner' || r === 'manager'
})
