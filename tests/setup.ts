import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import {
  computed,
  inject,
  isRef,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  provide,
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
import { useAppFormMode } from '~/composables/useAppFormMode'
import UiButton from '~/components/ui/UiButton.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiDropdownMenu from '~/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '~/components/ui/UiDropdownMenuItem.vue'
import UiListToolbar from '~/components/ui/UiListToolbar.vue'
import UiBulkActionsBar from '~/components/ui/UiBulkActionsBar.vue'
import UiSelectAllBar from '~/components/ui/UiSelectAllBar.vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiDefinitionList from '~/components/ui/UiDefinitionList.vue'
import UiDefinitionItem from '~/components/ui/UiDefinitionItem.vue'
import UiListPanel from '~/components/ui/UiListPanel.vue'
import UiFormSection from '~/components/ui/UiFormSection.vue'
import UiFormActions from '~/components/ui/UiFormActions.vue'
import UiFormDraftBanner from '~/components/ui/UiFormDraftBanner.vue'
import { ok, paginated, parseBody, parseQuery } from '../server/utils/api'

const stateStore = new Map<string, ReturnType<typeof ref>>()

config.global.components = {
  ...config.global.components,
  UiButton,
  UiCheckbox,
  UiDropdownMenu,
  UiDropdownMenuItem,
  UiListToolbar,
  UiBulkActionsBar,
  UiSelectAllBar,
  UiPagination,
  UiDefinitionList,
  UiDefinitionItem,
  UiListPanel,
  UiFormSection,
  UiFormActions,
  UiFormDraftBanner,
}

// Nuxt auto-imports these into Vue SFCs at build-time. In vitest we don't run
// the Nuxt build, so we expose the same identifiers on globalThis. Components
// that import explicitly are unaffected (the import wins over the global).
for (const [name, fn] of Object.entries({
  computed, inject, isRef, nextTick, onBeforeMount, onBeforeUnmount, onMounted, onUnmounted,
  provide, reactive, readonly, ref, shallowRef, toRaw, toRef, toRefs, toValue, unref, useId, watch, watchEffect,
  useBulkSelection,
  useAppFormMode,
})) {
  vi.stubGlobal(name, fn)
}

// Minimal stand-in for Nuxt's `useState`: one shared ref per key, per test file.
vi.stubGlobal('useState', <T>(key: string, init?: () => T) => {
  if (!stateStore.has(key)) stateStore.set(key, ref(init?.()))
  return stateStore.get(key)!
})

// `getVisibleBuildingIds` hits this on every scoped list request. Default to
// "nothing hidden" so unrelated service tests keep their pre-visibility scope;
// visibility tests override this mock per file.
vi.mock('../server/repositories/buildings/visibility', () => ({
  BuildingVisibilityRepository: {
    findHiddenIds: vi.fn(async () => [] as string[]),
    findVisibleIds: vi.fn(async () => [] as string[]),
  },
}))

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

vi.stubGlobal('throwConflict', (message = 'Conflict', details?: unknown) => {
  throw appError(409, 'CONFLICT', message, details)
})

vi.stubGlobal('throwValidationError', (message = 'Validation error', details?: unknown) => {
  throw appError(422, 'VALIDATION_ERROR', message, details)
})

vi.stubGlobal('throwInternal', (originalError: unknown, context?: string) => {
  throw appError(500, 'INTERNAL', 'Lỗi hệ thống, vui lòng thử lại.', context ? { context } : undefined)
})

vi.stubGlobal('throwDbError', (originalError: unknown, context?: string) => {
  throw appError(500, 'INTERNAL', 'Lỗi hệ thống, vui lòng thử lại.', context ? { context } : undefined)
})

// Server request helpers from server/utils/api.ts (auto-imported in Nitro).
// Expose the real implementations; they resolve readBody/getQuery/throwValidationError
// against the current globals at call time, so per-test H3 stubs still apply.
vi.stubGlobal('parseBody', parseBody)
vi.stubGlobal('parseQuery', parseQuery)
vi.stubGlobal('ok', ok)
vi.stubGlobal('paginated', paginated)

vi.stubGlobal('throwForbidden', (message = 'Forbidden') => {
  throw appError(403, 'FORBIDDEN', message)
})

vi.stubGlobal('throwNotFound', (message = 'Not found') => {
  throw appError(404, 'NOT_FOUND', message)
})

vi.stubGlobal('can', () => true)

// New shared server helpers (server/utils/permissions.ts, repository-helpers.ts).
// Resolve dependent helpers from globals at call time so per-test overrides
// (e.g. stubbing `can` to false) still apply.
vi.stubGlobal('requireCapability', (user: unknown, capability: string, message?: string) => {
  const g = globalThis as {
    can: (u: unknown, c: string) => boolean
    throwForbidden: (m?: string) => never
  }
  if (!g.can(user, capability)) g.throwForbidden(message)
})

vi.stubGlobal('calculatePaginationBounds', (page: number, limit: number) => {
  const from = (page - 1) * limit
  return { from, to: from + limit - 1 }
})

vi.stubGlobal('throwIfUniqueViolation', (error: { code?: string } | null, message: string) => {
  if (error?.code === '23505') {
    (globalThis as { throwConflict: (m: string) => never }).throwConflict(message)
  }
})

vi.stubGlobal('useToast', () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }))
vi.stubGlobal('apiFetch', (...args: unknown[]) => (globalThis as { $fetch: (...values: unknown[]) => unknown }).$fetch(...args))
vi.stubGlobal('createLatestApiRequest', () => (...args: unknown[]) => (
  globalThis as { apiFetch: (...values: unknown[]) => unknown }
).apiFetch(...args))

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
