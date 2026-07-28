# Portal UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide reusable MapTrack portal input and chip primitives, then document the portal foundation in the development-only showcase.

**Architecture:** `PortalInput` supersedes `PortalTextField` without changing page form models or API flows. `PortalChip` is presentational with an explicit `select` intent for interactive use. Existing `.portal-shell` semantic variables remain the single styling source; the showcase composes them into reference sections rather than introducing global tokens.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Tailwind utility classes, SCSS portal variables, Vitest, Vue Test Utils.

## Global Constraints

- Portal-only scope; do not modify dashboard components, routes, or tokens.
- Preserve MapTrack dark/light variables in `app/assets/scss/main.scss` under `.portal-shell`.
- Use no new dependencies, SVG markup, global theme, or business/data changes.
- Cover default, selected, invalid, disabled, keyboard-focus, responsive, and reduced-motion-relevant states.

---

### Task 1: Introduce `PortalInput` and migrate the profile form

**Files:**
- Create: `app/components/portal/PortalInput.vue`
- Modify: `app/pages/portal/profile.vue`
- Modify: `tests/pages/portal-profile-ui.spec.ts`
- Test: `tests/components/portal/PortalInput.spec.ts`

**Consumes:** Existing `PortalTextField` field contract and portal variables.

**Produces:** `PortalInput` with `v-model`, accessible feedback, native input/textarea support, and visible invalid/disabled states.

- [x] **Step 1: Write the failing component and page-contract tests**

```ts
expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
expect(wrapper.find('p').attributes('id')).toContain('-error')
expect(page.match(/<PortalInput/g)).toHaveLength(11)
```

- [x] **Step 2: Run the new and modified tests to verify they fail**

Run: `npx vitest run tests/components/portal/PortalInput.spec.ts tests/pages/portal-profile-ui.spec.ts`

Expected: FAIL because `PortalInput.vue` does not exist and the profile still uses `PortalTextField`.

- [x] **Step 3: Implement the smallest compatible primitive and update the profile references**

```vue
<PortalInput
  v-model="form.full_name"
  label="Họ và tên"
  :error="fieldErrors.full_name?.[0]"
/>
```

- [x] **Step 4: Re-run the focused tests**

Run: `npx vitest run tests/components/portal/PortalInput.spec.ts tests/pages/portal-profile-ui.spec.ts`

Expected: PASS.

### Task 2: Add `PortalChip`

**Files:**
- Create: `app/components/portal/PortalChip.vue`
- Test: `tests/components/portal/PortalChip.spec.ts`

**Consumes:** Existing portal surface, status, focus, motion, and radius variables.

**Produces:** A typed presentational/interactive chip with five tones and a named `select` event.

- [x] **Step 1: Write the failing chip tests**

```ts
expect(wrapper.element.tagName).toBe('BUTTON')
expect(wrapper.attributes('aria-pressed')).toBe('true')
await wrapper.trigger('click')
expect(wrapper.emitted('select')).toHaveLength(1)
```

- [x] **Step 2: Run the chip test to verify it fails**

Run: `npx vitest run tests/components/portal/PortalChip.spec.ts`

Expected: FAIL because `PortalChip.vue` does not exist.

- [x] **Step 3: Implement the chip contract**

```vue
<component :is="interactive ? 'button' : 'span'" @click="interactive && emit('select')">
  <slot />
</component>
```

- [x] **Step 4: Re-run the chip test**

Run: `npx vitest run tests/components/portal/PortalChip.spec.ts`

Expected: PASS.

### Task 3: Expand the portal foundation showcase

**Files:**
- Modify: `app/pages/portal/ui-showcase.vue`
- Modify: `tests/pages/portal-ui-showcase.spec.ts`
- Modify: `app/assets/scss/main.scss`

**Consumes:** `PortalInput`, `PortalChip`, existing `--portal-*` variables, `PortalCard`, and type/elevation utilities.

**Produces:** Development-only sections for Color Palette, Typography, Spacing, Inputs, Elevation & Depth, and Chips, with no global style leakage.

- [x] **Step 1: Write the failing showcase contract test**

```ts
for (const heading of ['Color Palette', 'Typography', 'Spacing', 'Inputs', 'Elevation & Depth', 'Chips']) {
  expect(source).toContain(heading)
}
expect(source).toContain('<PortalChip')
expect(source).toContain('<PortalInput')
```

- [x] **Step 2: Run the showcase test to verify it fails**

Run: `npx vitest run tests/pages/portal-ui-showcase.spec.ts`

Expected: FAIL because the new reference sections and primitives are absent.

- [x] **Step 3: Compose foundation examples and add only portal-scoped helper classes needed for token swatches and spacing bars**

```vue
<section aria-labelledby="chips-title" class="space-y-3">
  <h3 id="chips-title" class="portal-type-heading text-title">Chips</h3>
  <PortalCard class="flex flex-wrap gap-2">
    <PortalChip tone="accent">Đang chọn</PortalChip>
  </PortalCard>
</section>
```

- [x] **Step 4: Re-run the showcase test**

Run: `npx vitest run tests/pages/portal-ui-showcase.spec.ts`

Expected: PASS.

### Task 4: Verify the portal primitive slice

**Files:**
- Verify only.

- [x] **Step 1: Run all portal component and changed page tests**

Run: `npx vitest run tests/components/portal tests/pages/portal-profile-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts`

Expected: PASS.

- [x] **Step 2: Run static verification**

Run: `npm run typecheck && npm run lint`

Expected: both commands exit 0.

- [x] **Step 3: Inspect the diff and verify boundaries**

Run: `git diff --check && git diff --name-only`

Expected: no whitespace errors and no dashboard file changes.
