# Portal MapTrack Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the tenant portal a MapTrack-derived light/dark theme with a persisted tenant preference and dark-first system fallback.

**Architecture:** A portal-only composable resolves `system`, `light`, and `dark` without browser APIs during SSR. `tenant.vue` applies the result as a local attribute; portal-scoped CSS tokens map existing utilities to MapTrack surfaces. The header exposes an accessible toggle.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, Tailwind CSS, scoped CSS custom properties.

## Global Constraints

- Change only the tenant portal; do not modify dashboard pages, layouts, or dashboard tokens.
- Store preference locally; no schema, API, or global setting is added.
- First use follows `prefers-color-scheme`; unavailable browser preference resolves to dark.
- Use MapTrack teal for primary action, orange for warning, navy for portal chrome.
- Preserve visible focus, 44px touch targets, safe-area behavior, reduced motion, and responsive navigation.

---

## File structure

- Create `app/composables/tenant-portal/usePortalTheme.ts`: SSR-safe preference resolution, persistence, media-query subscription, and toggling.
- Create `tests/composables/usePortalTheme.test.ts`: resolution and persistence coverage.
- Modify `app/layouts/tenant.vue`: attach the resolved theme to `.portal-shell` only.
- Modify `app/components/portal/PortalHeader.vue`: add an accessible light/dark toggle.
- Modify `tests/components/portal/PortalHeader.spec.ts`: header toggle semantics and click intent.
- Modify `app/assets/scss/main.scss`: MapTrack semantic light/dark tokens and portal-only bridges.
- Modify `app/components/portal/PortalTabBar.vue` and its spec: semantic chrome surface.

### Task 1: Add the portal theme preference composable

**Files:** Create `tests/composables/usePortalTheme.test.ts`; create `app/composables/tenant-portal/usePortalTheme.ts`.

**Interfaces:** `type PortalThemePreference = 'system' | 'light' | 'dark'`; `usePortalTheme()` returns `preference`, `resolvedTheme`, `initialize`, `setPreference`, and `toggleTheme`.

- [ ] **Step 1: Write the failing test**

```ts
it('persists an explicit preference and protects it from system updates', () => {
  const { resolvedTheme, initialize, setPreference } = usePortalTheme()
  initialize()
  setPreference('light')
  expect(window.localStorage.getItem('portal-theme-preference')).toBe('light')
  expect(resolvedTheme.value).toBe('light')
  emitSystemChange(true)
  expect(resolvedTheme.value).toBe('light')
})
```

- [ ] **Step 2: Run red** — `npm test -- tests/composables/usePortalTheme.test.ts`; expected: missing composable failure.

- [ ] **Step 3: Implement minimally**

```ts
export type PortalThemePreference = 'system' | 'light' | 'dark'
export type PortalResolvedTheme = Exclude<PortalThemePreference, 'system'>
export function usePortalTheme() {
  const resolvedTheme = computed<PortalResolvedTheme>(() => preference.value === 'system'
    ? (systemPrefersDark.value ? 'dark' : 'light') : preference.value)
  function initialize() {
    preference.value = readPreference(window.localStorage.getItem(STORAGE_KEY))
    mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
    systemPrefersDark.value = mediaQuery?.matches ?? true
    mediaQuery?.addEventListener('change', event => {
      if (preference.value === 'system') systemPrefersDark.value = event.matches
    })
  }
  function setPreference(next: PortalThemePreference) {
    preference.value = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }
  function toggleTheme() { setPreference(resolvedTheme.value === 'dark' ? 'light' : 'dark') }
  return { preference, resolvedTheme, initialize, setPreference, toggleTheme }
}
```

- [ ] **Step 4: Run green** — `npm test -- tests/composables/usePortalTheme.test.ts`; expected: PASS.
- [ ] **Step 5: Commit** — `git add app/composables/tenant-portal/usePortalTheme.ts tests/composables/usePortalTheme.test.ts && git commit -m "feat(portal): add local theme preference"`.

### Task 2: Apply theme state and add the header control

**Files:** Modify `app/layouts/tenant.vue`, `app/components/portal/PortalHeader.vue`, and `tests/components/portal/PortalHeader.spec.ts`.

**Interfaces:** consume Task 1; produce `<div class="portal-shell" :data-theme="resolvedTheme">` and a 44px control whose label describes the next appearance.

- [ ] **Step 1: Write the failing test**

```ts
it('provides a labelled theme control that requests the opposite appearance', async () => {
  const toggleTheme = vi.fn()
  vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('dark'), toggleTheme }))
  const wrapper = mount(PortalHeader, { global: { stubs: { IconArrowLeft: true, IconSun: true } } })
  const control = wrapper.get('[aria-label="Chuyển sang giao diện sáng"]')
  await control.trigger('click')
  expect(toggleTheme).toHaveBeenCalledOnce()
  expect(control.classes()).toContain('min-h-[44px]')
})
```

- [ ] **Step 2: Run red** — `npm test -- tests/components/portal/PortalHeader.spec.ts`; expected: absent control failure.
- [ ] **Step 3: Implement minimally** — call `initialize` in `onMounted`, bind `:data-theme="resolvedTheme"`, and derive `themeActionLabel` from `resolvedTheme`. Render an `IconSun` or `IconMoon` button with `@click="toggleTheme"`, visible focus, and 44px dimensions.
- [ ] **Step 4: Run green** — `npm test -- tests/components/portal/PortalHeader.spec.ts`; expected: PASS.
- [ ] **Step 5: Commit** — `git add app/layouts/tenant.vue app/components/portal/PortalHeader.vue tests/components/portal/PortalHeader.spec.ts && git commit -m "feat(portal): add theme switch control"`.

### Task 3: Apply MapTrack semantic tokens

**Files:** Modify `app/assets/scss/main.scss`, `app/components/portal/PortalTabBar.vue`, `tests/components/portal/PortalTabBar.spec.ts`; test `tests/pages/portal-home-ui.spec.ts`.

**Interfaces:** consume `data-theme="light" | "dark"`; produce semantic token coverage for portal cards, forms, navigation, overlays, and status surfaces while dashboard styles remain unchanged.

- [ ] **Step 1: Write failing structural assertion**

```ts
it('uses the portal semantic chrome surface for the mobile tab bar', () => {
  const wrapper = mountTabBar()
  expect(wrapper.get('nav').classes()).toContain('bg-[color:var(--portal-chrome)]')
})
```

- [ ] **Step 2: Run red** — `npm test -- tests/components/portal/PortalTabBar.spec.ts tests/pages/portal-home-ui.spec.ts`; expected: missing semantic chrome hook failure.
- [ ] **Step 3: Implement minimally** — define `--portal-primary: #0D9488`, `--portal-warning: #F97316`, and `--portal-navy: #1E3A5F`; establish `[data-theme='light']` and `[data-theme='dark']` portal token sets; route shell chrome through `--portal-chrome`; retain every bridge selector beneath `.portal-shell`.
- [ ] **Step 4: Run green** — `npm test -- tests/components/portal/PortalTabBar.spec.ts tests/pages/portal-home-ui.spec.ts`; expected: PASS.
- [ ] **Step 5: Commit** — `git add app/assets/scss/main.scss app/components/portal/PortalTabBar.vue tests/components/portal/PortalTabBar.spec.ts tests/pages/portal-home-ui.spec.ts && git commit -m "feat(portal): apply MapTrack light and dark tokens"`.

### Task 4: Verify portal scope and quality

**Files:** Modify only if verification reveals a portal issue in files from Tasks 1–3.

- [ ] **Step 1: Run focused tests** — `npm test -- tests/composables/usePortalTheme.test.ts tests/components/portal/PortalHeader.spec.ts tests/components/portal/PortalTabBar.spec.ts tests/pages/portal-home-ui.spec.ts`; expected: PASS.
- [ ] **Step 2: Run static checks** — `npm run typecheck && npm run lint`; expected: exit 0.
- [ ] **Step 3: Inspect responsive states** — with separate approval to start a local runtime, inspect home, invoices, room, requests, and profile in both themes at 320, 375, 414, 768, and desktop. Verify no horizontal overflow, single-line controls, focus, and reduced motion.
- [ ] **Step 4: Confirm scope** — `git diff --name-only HEAD~3..HEAD`; expected: no dashboard page/component/layout files.
