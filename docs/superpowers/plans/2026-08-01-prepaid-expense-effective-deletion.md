# Prepaid Expense Effective Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm and apply prepaid-expense deletion from the current Vietnam month while preserving allocations in older report periods and preserving business API errors in the client.

**Architecture:** Keep `DELETE /api/prepaid-expenses/:id`, but make the service choose between physical deletion for not-yet-effective rows and effective cancellation for rows with historical allocations. The report snapshot uses `start_date <= period_start < end_date` as the allocation source of truth for active, expired, and cancelled rows. The existing building-settings page composes `UiConfirmModal`; the shared API client normalizes Nitro's nested error envelope.

**Tech Stack:** Nuxt 4.4, Vue 3.5, TypeScript, Vitest, Supabase Postgres, OpenSpec.

## Global Constraints

- The cancellation period is the current month in `Asia/Ho_Chi_Minh` and is effective on the month's first day.
- Closed periods are never reopened or recomputed by this deletion workflow.
- Existing `prepaid-expenses.write` capability and building-scope checks remain mandatory.
- Browser business data continues through page -> composable -> API -> service -> repository -> Supabase.
- Use the existing `UiConfirmModal`, dark/cyan design tokens, icon convention, and Vietnamese copy with full diacritics.
- Do not add dependencies, tables, UI primitives, themes, or snapshot infrastructure.
- Preserve unrelated working-tree changes.

---

## File Map

- `app/utils/api-fetch.ts`: normalize direct and Nitro-nested standardized API errors.
- `tests/utils/api-fetch.test.ts`: prove 409 preservation and true network fallback.
- `app/utils/format/period.ts`: provide one shared `Asia/Ho_Chi_Minh` current-period helper.
- `tests/utils/format-period.test.ts`: verify the shared helper at a UTC/Vietnam month boundary.
- `server/services/operations-report/prepaid-expenses.ts`: calculate Vietnam cancellation month and select physical delete vs effective cancellation.
- `tests/server/operations-report/prepaid-expense-service.test.ts`: service behavior, audit, scope, and lock regression coverage.
- `supabase/sql-editor/phase-2-report-and-bulk-rpcs.sql`: keep the canonical SQL-editor function source aligned with the migration.
- `tests/server/operations-report/prepaid-effective-deletion-sql.test.ts`: validate the status-independent date-window predicate and function security.
- `app/pages/dashboard/buildings/[id]/settings.vue`: confirmation state, modal content, loading/error/success states, and active-only action.
- `tests/pages/building-settings-prepaid-delete.spec.ts`: focused UI contract coverage.
- `openspec/specs/prepaid-expenses/spec.md`: accepted effective-deletion behavior.
- `openspec/specs/operations-report/spec.md`: closure-lock exception for non-retroactive cancellation.
- `docs/features/operations-report.md`: operator-facing behavior documentation.

---

### Task 1: Preserve standardized Nitro API errors

**Files:**
- Modify: `tests/utils/api-fetch.test.ts`
- Modify: `app/utils/api-fetch.ts`

**Interfaces:**
- Consumes: Nuxt `$fetch` rejection shapes.
- Produces: `normalizeApiFetchError(error: unknown): unknown`, used internally by `apiFetch`.

- [ ] **Step 1: Add failing tests for nested business errors and real network errors**

Add tests that reject `$fetch` with Nitro's actual nested payload and assert the standardized inner error survives:

```ts
it('preserves a standardized API error nested by Nitro', async () => {
  const nitroError = {
    data: {
      error: true,
      statusCode: 409,
      data: {
        error: {
          code: 'CONFLICT',
          message: 'Thay đổi này ảnh hưởng báo cáo vận hành đã chốt',
        },
      },
    },
  }
  vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(nitroError))

  await expect(apiFetch('/api/prepaid-expenses/p-1', { method: 'DELETE' }))
    .rejects.toMatchObject({
      data: { error: { code: 'CONFLICT', message: 'Thay đổi này ảnh hưởng báo cáo vận hành đã chốt' } },
    })
})

it('uses the connectivity message only when no API envelope exists', async () => {
  vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

  await expect(apiFetch('/api/example')).rejects.toMatchObject({
    data: { error: { code: 'INTERNAL', message: 'Yêu cầu mất quá nhiều thời gian hoặc kết nối bị gián đoạn.' } },
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- tests/utils/api-fetch.test.ts`

Expected: nested 409 test fails because `apiFetch` replaces it with `INTERNAL`.

- [ ] **Step 3: Implement minimal envelope normalization**

Add a helper that accepts either standardized location and returns one stable error:

```ts
interface StandardApiError {
  code?: string
  message?: string
  details?: unknown
}

function standardizedErrorOf(error: unknown): StandardApiError | undefined {
  const candidate = error as {
    data?: {
      error?: StandardApiError
      data?: { error?: StandardApiError }
    }
  }
  return candidate.data?.error?.code
    ? candidate.data.error
    : candidate.data?.data?.error?.code
      ? candidate.data.data.error
      : undefined
}
```

In the catch handler, throw `{ ...existing, data: { error: standardized } }` when found; preserve `AbortError`; only synthesize the connectivity message otherwise.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm test -- tests/utils/api-fetch.test.ts`

Expected: all `apiFetch` tests pass.

- [ ] **Step 5: Commit the isolated client fix**

```bash
git add app/utils/api-fetch.ts tests/utils/api-fetch.test.ts
git commit -m "fix: preserve nested API errors"
```

---

### Task 2: Cancel an effective prepaid expense from the current Vietnam month

**Files:**
- Modify: `tests/server/operations-report/prepaid-expense-service.test.ts`
- Create: `tests/utils/format-period.test.ts`
- Modify: `app/utils/format/period.ts`
- Modify: `server/services/operations-report/prepaid-expenses.ts`

**Interfaces:**
- Consumes: `PrepaidExpenseRepository.updateById`, `deleteById`, and existing audit/cache services.
- Produces: shared `currentVietnamPeriod(at?: Date): string`; `PrepaidExpenseService.delete` performs physical deletion or effective cancellation.

- [ ] **Step 1: Add failing service tests**

First prove the shared helper handles a UTC/Vietnam month boundary:

```ts
expect(currentVietnamPeriod(new Date('2026-07-31T17:30:00Z'))).toBe('2026-08')
```

Then freeze time and cover both service branches:

```ts
it('cancels an allocated prepaid from the current Vietnam month without checking old locks', async () => {
  vi.setSystemTime(new Date('2026-08-01T00:30:00+07:00'))
  findById.mockResolvedValue(prepaid({ startDate: '2026-06-01', endDate: '2026-12-01' }))

  const { PrepaidExpenseService } = await import('../../../server/services/operations-report/prepaid-expenses')
  await PrepaidExpenseService.delete({} as never, owner, 'prepaid-1')

  expect(updateById).toHaveBeenCalledWith(expect.anything(), 'prepaid-1', {
    end_date: '2026-08-01',
    status: 'cancelled',
  })
  expect(deleteById).not.toHaveBeenCalled()
  expect(assertNoClosedReportsInRange).toHaveBeenCalledWith(
    expect.anything(),
    'building-1',
    2026,
    8,
    2026,
    8,
  )
  expect(appendAudit).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining({
    before_data: expect.objectContaining({ id: 'prepaid-1' }),
    after_data: expect.objectContaining({ status: 'cancelled', endDate: '2026-08-01' }),
  }))
})

it('physically deletes a prepaid that has not started by the current Vietnam month', async () => {
  vi.setSystemTime(new Date('2026-08-01T00:30:00+07:00'))
  findById.mockResolvedValue(prepaid({ startDate: '2026-09-01', endDate: '2026-12-01' }))

  const { PrepaidExpenseService } = await import('../../../server/services/operations-report/prepaid-expenses')
  await PrepaidExpenseService.delete({} as never, owner, 'prepaid-1')

  expect(deleteById).toHaveBeenCalledWith(expect.anything(), 'prepaid-1')
  expect(updateById).not.toHaveBeenCalled()
})
```

Reset fake timers in `afterEach` and make `updateById` return the expected cancelled DTO in the first test.

- [ ] **Step 2: Run the service test and verify RED**

Run: `npm test -- tests/utils/format-period.test.ts tests/server/operations-report/prepaid-expense-service.test.ts`

Expected: cancellation test fails because the service calls the closed-report lock and physical delete.

- [ ] **Step 3: Implement Vietnam month calculation and delete branching**

Add the shared helper to `app/utils/format/period.ts` so server and UI are independent of host timezone:

```ts
export function currentVietnamPeriod(at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(at)
  const year = parts.find(part => part.type === 'year')!.value
  const month = parts.find(part => part.type === 'month')!.value
  return `${year}-${month}`
}
```

In `delete`, retain permission/scope checks, reject non-active historical rows, and branch:

```ts
const cancellationStart = `${currentVietnamPeriod()}-01`
if (existing.startDate >= cancellationStart) {
  await PrepaidExpenseRepository.deleteById(event, id)
  // audit before_data only
}
else {
  const cancellation = parseDate(cancellationStart)
  await OperationsReportLockService.assertNoClosedReportsInRange(
    event,
    existing.buildingId,
    cancellation.getUTCFullYear(),
    cancellation.getUTCMonth() + 1,
    cancellation.getUTCFullYear(),
    cancellation.getUTCMonth() + 1,
  )
  const cancelled = await PrepaidExpenseRepository.updateById(event, id, {
    end_date: cancellationStart,
    status: 'cancelled',
  })
  // audit before_data + after_data: cancelled
}
invalidateOperationsReport(existing.buildingId)
```

Replace the delete-path full-lifetime lock with a lock check for the cancellation month only. This permits closed 06–07/2026 history while still preventing a cancellation from changing 08/2026 if that current report has already closed. Create and update retain their existing full affected-range locks.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm test -- tests/utils/format-period.test.ts tests/server/operations-report/prepaid-expense-service.test.ts`

Expected: all prepaid service tests pass, including scope and audit assertions.

- [ ] **Step 5: Commit the server behavior**

```bash
git add app/utils/format/period.ts server/services/operations-report/prepaid-expenses.ts tests/utils/format-period.test.ts tests/server/operations-report/prepaid-expense-service.test.ts
git commit -m "feat: cancel prepaid expenses by period"
```

---

### Task 3: Preserve historical allocations in the report snapshot

**Files:**
- Modify: `supabase/sql-editor/phase-2-report-and-bulk-rpcs.sql`
- Create: `tests/server/operations-report/prepaid-effective-deletion-sql.test.ts`

**Interfaces:**
- Consumes: existing `public.operations_report_snapshot(uuid, integer, integer)` signature.
- Produces: the same SECURITY INVOKER RPC and JSON contract with a status-independent prepaid effective window.

- [ ] **Step 1: Add a failing SQL contract test**

Read `supabase/sql-editor/phase-2-report-and-bulk-rpcs.sql`, then assert:

```ts
expect(sql).toContain('create or replace function public.operations_report_snapshot')
expect(sql).toContain("security invoker")
expect(sql).toContain('p.start_date <= make_date(p_period_year, p_period_month, 1)')
expect(sql).toContain('p.end_date > make_date(p_period_year, p_period_month, 1)')
expect(sql).not.toContain("p.status = 'active'")
expect(sql).toContain('grant execute on function public.operations_report_snapshot(uuid, integer, integer) to service_role')
```

- [ ] **Step 2: Run the SQL test and verify RED**

Run: `npm test -- tests/server/operations-report/prepaid-effective-deletion-sql.test.ts`

Expected: test fails because the snapshot still contains `p.status = 'active'`.

- [ ] **Step 3: Update the canonical SQL Editor source**

In `prepaid_rows`, retain the existing monthly remainder calculation and use exactly:

```sql
from public.prepaid_expenses p
where p.building_id = p_building_id
  and p.start_date <= make_date(p_period_year, p_period_month, 1)
  and p.end_date > make_date(p_period_year, p_period_month, 1)
```

Keep `language sql`, `stable`, `security invoker`, `set search_path = ''`, the existing revoke statements, and the `service_role` execute grant.

- [ ] **Step 4: Run SQL and snapshot tests and verify GREEN**

Run: `npm test -- tests/server/operations-report/prepaid-effective-deletion-sql.test.ts tests/server/operations-report/snapshot-performance.test.ts`

Expected: both test files pass.

- [ ] **Step 5: Apply the RPC through Supabase SQL Editor**

Open the linked project SQL Editor, execute only the `create or replace function public.operations_report_snapshot(...)` statement plus its revoke/grant statements from the canonical file, and confirm the editor reports success.

- [ ] **Step 6: Verify the deployed predicate without mutating business data**

Run a read-only SQL verification against the function definition and existing prepaid record:

```sql
select pg_get_functiondef('public.operations_report_snapshot(uuid, integer, integer)'::regprocedure)
  not like '%p.status = ''active''%' as status_independent_window;
```

Expected: `status_independent_window = true`. Do not create or modify production rows for verification.

- [ ] **Step 7: Commit the SQL change**

```bash
git add supabase/sql-editor/phase-2-report-and-bulk-rpcs.sql tests/server/operations-report/prepaid-effective-deletion-sql.test.ts docs/superpowers/plans/2026-08-01-prepaid-expense-effective-deletion.md
git commit -m "fix: preserve historical prepaid allocations"
```

---

### Task 4: Require explicit confirmation in building settings

**Files:**
- Create: `tests/pages/building-settings-prepaid-delete.spec.ts`
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`

**Interfaces:**
- Consumes: `deletePrepaidExpense(id)`, `UiConfirmModal`, `toast`, `currentVietnamPeriod`.
- Produces: `prepaidDeleteTarget`, `deletingPrepaid`, `openPrepaidDelete`, `confirmPrepaidDelete`, and active-only delete controls.

- [ ] **Step 1: Add a failing focused UI contract test**

Read the page source and assert the destructive action is gated by modal state:

```ts
expect(page).toContain('const prepaidDeleteTarget = ref<PrepaidExpense | null>(null)')
expect(page).toContain('@click="openPrepaidDelete(item)"')
expect(page).toContain('v-if="item.status === \'active\'"')
expect(page).toContain('<UiConfirmModal')
expect(page).toContain('confirm-label="Xóa và ngừng phân bổ"')
expect(page).toContain('@confirm="confirmPrepaidDelete"')
expect(page).toContain('Số liệu các kỳ đã chốt được giữ nguyên.')
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- tests/pages/building-settings-prepaid-delete.spec.ts`

Expected: assertions fail because the icon currently calls `removePrepaid` directly and no modal exists.

- [ ] **Step 3: Implement confirmation state and action**

Add state and handlers:

```ts
const prepaidDeleteTarget = ref<PrepaidExpense | null>(null)
const deletingPrepaid = ref(false)
const prepaidCancellationPeriod = currentVietnamPeriod(now)
const [prepaidCancellationYear, prepaidCancellationMonth] = prepaidCancellationPeriod.split('-')
const prepaidCancellationPeriodLabel = `${prepaidCancellationMonth}/${prepaidCancellationYear}`

function openPrepaidDelete(item: PrepaidExpense) {
  prepaidError.value = null
  prepaidDeleteTarget.value = item
}

async function confirmPrepaidDelete() {
  const target = prepaidDeleteTarget.value
  if (!target || deletingPrepaid.value) return
  deletingPrepaid.value = true
  try {
    await deletePrepaidExpense(target.id)
    prepaidDeleteTarget.value = null
    toast.success(`Đã ngừng phân bổ “${target.name}” từ ${prepaidCancellationPeriodLabel}.`)
  }
  catch (err) {
    prepaidError.value = resolveApiError(err, 'Không xóa được chi phí trả trước.')
  }
  finally {
    deletingPrepaid.value = false
  }
}
```

Render the trash action only for `active` rows and open the modal. Add one page-level `UiConfirmModal` after the prepaid section:

```vue
<UiConfirmModal
  :open="Boolean(prepaidDeleteTarget)"
  title="Xóa chi phí trả trước?"
  message=""
  confirm-label="Xóa và ngừng phân bổ"
  :loading="deletingPrepaid"
  @confirm="confirmPrepaidDelete"
  @cancel="prepaidDeleteTarget = null"
>
  <p class="text-sm text-muted">
    Xóa “{{ prepaidDeleteTarget?.name }}”? Số liệu các kỳ đã chốt được giữ nguyên.
    Khoản này sẽ ngừng phân bổ từ {{ prepaidCancellationPeriodLabel }}.
  </p>
</UiConfirmModal>
```

Use `aria-label="Xóa chi phí trả trước"`, preserve visible focus through `UiButton`, and do not add custom modal styling.

- [ ] **Step 4: Run the UI test and verify GREEN**

Run: `npm test -- tests/pages/building-settings-prepaid-delete.spec.ts`

Expected: all confirmation contract assertions pass.

- [ ] **Step 5: Perform focused UI polish review**

Check 320px and desktop layout in the runnable app: long expense names wrap inside the modal, buttons remain reachable, loading prevents duplicate confirmation, cancelled/expired rows remain readable without a delete action, and no horizontal overflow appears.

- [ ] **Step 6: Commit the UI behavior**

```bash
git add app/pages/dashboard/buildings/[id]/settings.vue tests/pages/building-settings-prepaid-delete.spec.ts
git commit -m "feat: confirm prepaid expense cancellation"
```

---

### Task 5: Synchronize accepted behavior and verify the complete change

**Files:**
- Modify: `openspec/specs/prepaid-expenses/spec.md`
- Modify: `openspec/specs/operations-report/spec.md`
- Modify: `docs/features/operations-report.md`

**Interfaces:**
- Consumes: completed client, service, SQL, and UI behavior.
- Produces: accepted requirement and operator documentation matching the code.

- [ ] **Step 1: Add the accepted prepaid scenarios**

Document these exact outcomes:

```md
#### Scenario: Delete an allocated prepaid expense
- **WHEN** an authorized user confirms deletion after the prepaid expense has started
- **THEN** the system preserves allocations before the current `Asia/Ho_Chi_Minh` month, marks the record `cancelled`, and excludes it from the current month onward

#### Scenario: Delete a future prepaid expense
- **WHEN** an authorized user confirms deletion before its start month
- **THEN** the system permanently removes the record because no historical allocation exists
```

- [ ] **Step 2: Clarify the closure-lock exception**

Add to the operations-report closure requirement:

```md
#### Scenario: Cancel prepaid without changing closed history
- **WHEN** a prepaid expense is cancelled from the current open month and it contributed to earlier closed reports
- **THEN** the earlier reports retain their allocations and the cancellation is not blocked by those closed periods
```

Update `docs/features/operations-report.md` with the same operator flow and note that cancelled/expired rows remain historical records.

- [ ] **Step 3: Validate specs and focused tests**

Run:

```bash
openspec validate --specs
npm test -- tests/utils/api-fetch.test.ts tests/utils/format-period.test.ts tests/server/operations-report/prepaid-expense-service.test.ts tests/server/operations-report/prepaid-effective-deletion-sql.test.ts tests/server/operations-report/snapshot-performance.test.ts tests/pages/building-settings-prepaid-delete.spec.ts
```

Expected: OpenSpec validation succeeds and all focused tests pass.

- [ ] **Step 4: Run repository verification**

Run:

```bash
npm run typecheck
npm run lint
npm test
```

Expected: all commands exit 0. If failures are in the user's pre-existing invoice-email/print-card work, report them separately and do not edit those files.

- [ ] **Step 5: Review the final diff and runtime behavior**

Run: `git diff --check` and inspect only files in this plan. Confirm:

- no closed-report lock remains in prepaid delete;
- create/update locks are unchanged;
- only the effective date window controls historical report inclusion;
- the modal is required before DELETE;
- Nitro 409 messages are not replaced by the connectivity fallback;
- no unrelated working-tree change is staged.

- [ ] **Step 6: Commit documentation**

```bash
git add openspec/specs/prepaid-expenses/spec.md openspec/specs/operations-report/spec.md docs/features/operations-report.md
git commit -m "docs: define prepaid effective deletion"
```
