# Portal Room Keycard Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the portal home identity hero into a room-first Room Keycard while preserving tenant identity, contract context, MapTrack light/dark styling, and room navigation.

**Architecture:** Keep the implementation inline in `app/pages/portal/index.vue` because the hero has one consumer and no independent behavior. Reorder existing DTO-backed content into contract header, room anchor, contract summary, and identity footer; protect the hierarchy with focused source-level regression tests.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Tailwind CSS, existing `PortalCard` and portal typography/theme tokens, Vitest.

## Global Constraints

- Apply only to the portal home identity hero; do not touch dashboard UI.
- Preserve the existing MapTrack portal light and dark modes.
- Do not add colors, typography tokens, fonts, gradients, shadows, icons, dependencies, or reusable primitives.
- Preserve `/portal/room` navigation and `PortalCard` interaction behavior.
- Preserve loading, active-contract, roommate, and no-active-contract states.
- Do not change portal APIs, DTOs, composables, or business behavior.
- Do not add inline SVG.

---

### Task 1: Recompose the portal home hero as a Room Keycard

**Files:**
- Modify: `tests/pages/portal-home-ui.spec.ts`
- Modify: `app/pages/portal/index.vue`

**Interfaces:**
- Consumes: existing `profile`, `contract`, `loading`, `greeting`, `formattedDate`, `initials`, `formatCurrency`, and `formatViDate` values from `app/pages/portal/index.vue`.
- Produces: the same portal home route and `/portal/room` navigation, with room-first visual order and no new public component interface.

- [ ] **Step 1: Write the failing room-first hierarchy test**

Add this test to `tests/pages/portal-home-ui.spec.ts`:

```ts
it('makes the room the hero anchor and moves identity into the footer', () => {
  const roomTitle = page.indexOf('Phòng {{ contract.roomNumber }}')
  const identityGreeting = page.indexOf('{{ greeting }}')

  expect(page).toContain('<!-- Room keycard header -->')
  expect(page).toContain('<!-- Room keycard identity footer -->')
  expect(page).toContain(
    'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
  )
  expect(roomTitle).toBeGreaterThan(-1)
  expect(identityGreeting).toBeGreaterThan(roomTitle)
  expect(page).toContain("navigateTo('/portal/room')")
  expect(page).toContain('Chưa có nơi ở đang hoạt động.')
})
```

Keep the existing assertions for the statement skeleton and roommate identity.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/pages/portal-home-ui.spec.ts
```

Expected: FAIL because the Room Keycard markers, room-first ordering, and new no-residence copy are not present.

- [ ] **Step 3: Implement the Room Keycard markup**

Replace only the current `<!-- Identity hero: greeting + room (unified) -->`
section in `app/pages/portal/index.vue`.

The active-contract structure must follow this order:

```vue
<!-- Room keycard header -->
<div class="flex items-start justify-between gap-3">
  <p class="portal-type-caption min-w-0 truncate text-body">
    {{ contract.buildingName }}
  </p>
  <p class="portal-type-caption shrink-0 text-right text-body">
    {{ formattedDate }}
  </p>
</div>

<div class="mt-2.5 flex items-end justify-between gap-3">
  <div class="min-w-0">
    <p class="portal-type-caption text-body">Nơi ở hiện tại</p>
    <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
      <p class="portal-type-display min-w-0 text-title">
        Phòng {{ contract.roomNumber }}
      </p>
      <span
        v-if="contract.assignmentRole === 'roommate'"
        class="rounded-full bg-theme/10 px-2 py-0.5 portal-type-caption font-semibold text-theme"
      >
        Người ở cùng
      </span>
    </div>
  </div>
  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
    <IconDoor class="h-5 w-5" aria-hidden="true" />
  </span>
</div>

<div class="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 rounded-xl bg-smoke-card px-3 py-2.5">
  <div class="min-w-0">
    <p class="portal-type-caption text-body">Tiền thuê</p>
    <p class="portal-money mt-0.5 text-sm font-semibold text-title">
      {{ formatCurrency(contract.monthlyRent) }}<span class="font-normal text-body">/th</span>
    </p>
  </div>
  <div class="min-w-0">
    <p class="portal-type-caption text-body">Hợp đồng</p>
    <p class="portal-money mt-0.5 text-sm font-semibold text-title">
      {{ formatViDate(contract.startDate) }} – {{ formatViDate(contract.endDate) }}
    </p>
  </div>
</div>
```

After the contract summary, render the shared identity block:

```vue
<!-- Room keycard identity footer -->
<div
  class="flex items-center gap-3"
  :class="contract ? 'mt-3 border-t border-border-light pt-3' : 'mt-2'"
>
  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-label font-bold text-theme">
    {{ initials }}
  </span>
  <div class="min-w-0 flex-1">
    <p class="portal-type-caption text-body">{{ greeting }}</p>
    <p class="portal-type-label truncate text-title">
      {{ profile?.fullName ?? 'Người thuê' }}
    </p>
    <p
      v-if="contract?.assignmentRole === 'roommate' && contract.primaryTenantName"
      class="portal-type-caption mt-0.5 truncate text-body"
    >
      Người đứng hợp đồng: {{ contract.primaryTenantName }}
    </p>
  </div>
  <IconChevronRight
    v-if="contract"
    class="h-4 w-4 shrink-0 text-body"
    aria-hidden="true"
  />
</div>
```

For the no-contract state, place this date before the shared identity block:

```vue
<p
  v-if="!contract"
  class="portal-type-caption text-right text-body"
>
  {{ formattedDate }}
</p>
```

Place this state message after the shared identity block:

```vue
<p
  v-if="!contract"
  class="portal-type-caption mt-3 border-t border-border-light pt-3 text-body"
>
  Chưa có nơi ở đang hoạt động.
</p>
```

Keep the card non-interactive through `:interactive="!!contract"` and omit the
room title, role chip, contract summary, door icon, and chevron when there is no
contract.

Keep the existing `PortalSkeleton` statement variant and `h-44` reservation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run tests/pages/portal-home-ui.spec.ts
```

Expected: all portal home UI tests PASS.

- [ ] **Step 5: Run focused portal regressions**

Run:

```bash
npx vitest run tests/components/portal tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts
```

Expected: all selected portal component and page tests PASS.

- [ ] **Step 6: Review the affected states and responsive constraints**

Review the source and confirm:

- room title precedes the identity footer for active contracts;
- long building, tenant, and primary-tenant names use `min-w-0` plus truncation;
- the contract summary uses two `minmax(0,1fr)` columns;
- the date is isolated from the room-title row;
- no-contract markup has no chevron;
- no new raw color, font, or shadow value appears;
- the only production file changed is `app/pages/portal/index.vue`.

- [ ] **Step 7: Commit the Room Keycard**

```bash
git add app/pages/portal/index.vue tests/pages/portal-home-ui.spec.ts
git commit -m "feat(portal): prioritize room in identity hero"
```

---

### Task 2: Verify and integrate the Room Keycard

**Files:**
- Verify: `app/pages/portal/index.vue`
- Verify: `tests/pages/portal-home-ui.spec.ts`

**Interfaces:**
- Consumes: the completed Room Keycard markup from Task 1.
- Produces: a verified local `main` containing the approved portal-only UI change.

- [ ] **Step 1: Run static and specification checks**

Run:

```bash
npm run typecheck
npm run lint
npx openspec validate --specs
git diff --check main...HEAD
```

Expected: every command exits with status 0.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: all test files and tests PASS.

- [ ] **Step 3: Perform the final focused UI critique**

Confirm the implementation:

- has one clear visual anchor: the room title;
- keeps building, date, contract, and identity subordinate;
- avoids nested interactive elements and decorative clutter;
- preserves both MapTrack portal themes;
- preserves loading and empty states;
- changes no dashboard, API, DTO, composable, theme, or primitive files.

If an authenticated portal runtime is already available, inspect 320, 375, 414,
and 768 pixel widths in both light and dark modes. Do not start a local runtime
without the required user approval.

- [ ] **Step 4: Merge local feature branch into `main`**

From the repository root:

```bash
git merge --no-ff feat/portal-room-keycard-hero -m "merge: portal room keycard hero"
```

Expected: merge completes without conflicts.

- [ ] **Step 5: Verify the merged `main`**

Run:

```bash
npx vitest run --exclude '.worktrees/**' tests/pages/portal-home-ui.spec.ts
npm test -- --exclude '.worktrees/**'
git status --short
```

Expected: focused and full tests PASS, and `git status --short` is empty.

- [ ] **Step 6: Clean up the merged worktree and branch**

```bash
git worktree remove .worktrees/feat-portal-room-keycard-hero
git branch -d feat/portal-room-keycard-hero
```

Expected: the feature worktree is removed and the merged branch is deleted.
