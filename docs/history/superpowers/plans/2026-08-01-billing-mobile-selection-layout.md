# Billing Mobile Selection Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the mobile draft checkbox visually attached to its room and tenant identity instead of distributing the identity toward the card center.

**Architecture:** Preserve the existing `BillingMobileDraftRow` public interface and selection state. Change only its header composition by introducing one left cluster around the checkbox and identity block, while the save-state block remains the right header child.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS, Vue Test Utils, Vitest

## Global Constraints

- Keep the checkbox touch target at least 44 × 44 CSS px.
- Preserve current selection, issue, permission, and API behavior.
- Preserve Zeno House dark/cyan/Inter tokens and existing UI primitives.
- Verify the layout contract for mobile widths 320, 375, 414, and 768 px.

---

### Task 1: Group mobile selection and room identity

**Files:**
- Modify: `app/components/billing/BillingMobileDraftRow.vue`
- Test: `tests/components/billing/BillingDraftGridStep.spec.ts`

**Interfaces:**
- Consumes: `selectable: boolean`, `selected: boolean`, `row: BillingDraftGridRow`, and `emit('select', row)`.
- Produces: a `data-test="mobile-draft-select-cluster"` left header cluster containing the checkbox and room identity.

- [ ] **Step 1: Write the failing regression assertion**

Add these assertions to the existing mobile selection test after obtaining `mobileRow`:

```ts
const selectionCluster = mobileRow.get('[data-test="mobile-draft-select-cluster"]')
expect(selectionCluster.find('[data-test="mobile-draft-select"]').exists()).toBe(true)
expect(selectionCluster.text()).toContain('101 · Tenant room-1')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/components/billing/BillingDraftGridStep.spec.ts --exclude '.worktrees/**'
```

Expected: the mobile selection test fails because `mobile-draft-select-cluster` does not exist.

- [ ] **Step 3: Implement the approved header grouping**

Replace the three independent header children with a left cluster and one right save-state block:

```vue
<header class="flex items-start justify-between gap-3">
  <div data-test="mobile-draft-select-cluster" class="flex min-w-0 flex-1 items-start gap-2">
    <UiCheckbox
      v-if="selectable"
      data-test="mobile-draft-select"
      class="shrink-0 [&>label]:size-11 [&>label]:items-center [&>label]:justify-center"
      :model-value="selected"
      :aria-label="`Chọn phòng ${row.roomNumber ?? ''} để phát hành`"
      @update:model-value="emit('select', row)"
    />
    <div class="min-w-0 pt-0.5">
      <p class="text-sm font-semibold text-white">
        {{ row.roomNumber ?? '—' }}
        <template v-if="row.tenantName">
          <span class="text-muted">{{ '· ' }}</span>
          <span class="text-white">{{ row.tenantName }}</span>
        </template>
      </p>
      <p v-if="row.draftTotal !== null" class="text-xs text-muted">
        Tổng nháp: <span class="text-white tabular-nums">{{ formatCurrency(row.draftTotal) }}</span>
      </p>
    </div>
  </div>
  <div class="shrink-0 pt-0.5 text-[11px]">
    <span v-if="saveStateOf(row) === 'saving'" class="text-muted">Đang lưu...</span>
    <span v-else-if="saveStateOf(row) === 'saved'" class="text-emerald-400">Đã lưu ✓</span>
    <span v-else-if="saveStateOf(row) === 'error'" class="text-rose-400">Lỗi</span>
  </div>
</header>
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx vitest run tests/components/billing/BillingDraftGridStep.spec.ts --exclude '.worktrees/**'
npx eslint app/components/billing/BillingMobileDraftRow.vue tests/components/billing/BillingDraftGridStep.spec.ts
npm run typecheck
```

Expected: 16 component tests pass, scoped ESLint exits with no findings, and Nuxt typecheck exits 0.

- [ ] **Step 5: Commit the implementation**

```bash
git add app/components/billing/BillingMobileDraftRow.vue tests/components/billing/BillingDraftGridStep.spec.ts docs/superpowers/plans/2026-08-01-billing-mobile-selection-layout.md
git commit -m "fix: align billing mobile selection"
```
