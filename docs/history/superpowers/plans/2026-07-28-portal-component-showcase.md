# Portal Component Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a development-only `/portal/ui-showcase` page that composes every tenant portal component with safe fixture data.

**Architecture:** One page owns its demo-only state and uses the existing tenant layout. A page-level development guard returns 404 in production; all cards, fields, feedback, chart, overlay, pull-to-refresh, and install-prompt components are composed without API calls or changes to dashboard code.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, Vue Test Utils, existing portal components.

## Global Constraints

- Route is development-only and not added to portal navigation.
- No business API, database, dashboard, or portal primitive change.
- Demo data is local and contains no real tenant data or fabricated performance metrics.
- Preserve tenant layout, MapTrack light/dark theme toggle, keyboard focus, reduced motion, and mobile overflow safety.

---

### Task 1: Add development-only route coverage

**Files:** Create `tests/pages/portal-ui-showcase.spec.ts`; create `app/pages/portal/ui-showcase.vue`.

- [ ] **Step 1: Write the failing page contract test**

```ts
it('declares the tenant layout and development-only middleware', () => {
  const source = readFileSync(resolve('app/pages/portal/ui-showcase.vue'), 'utf8')
  expect(source).toContain("layout: 'tenant'")
  expect(source).toContain('import.meta.dev')
  expect(source).toContain("statusCode: 404")
})
```

- [ ] **Step 2: Run red** — `npm test -- tests/pages/portal-ui-showcase.spec.ts`; expected: route file missing.
- [ ] **Step 3: Implement route guard** — use `definePageMeta({ layout: 'tenant', middleware: () => { if (!import.meta.dev) return abortNavigation(createError({ statusCode: 404 })) } })`.
- [ ] **Step 4: Run green** — `npm test -- tests/pages/portal-ui-showcase.spec.ts`; expected: PASS.
- [ ] **Step 5: Commit** — `git add app/pages/portal/ui-showcase.vue tests/pages/portal-ui-showcase.spec.ts && git commit -m "feat(portal): add development showcase route"`.

### Task 2: Compose all portal component groups

**Files:** Modify `app/pages/portal/ui-showcase.vue`; modify `tests/pages/portal-ui-showcase.spec.ts`.

- [ ] **Step 1: Write failing section assertions**

```ts
it('renders fixture demos for every portal component group', () => {
  for (const component of ['PortalButton', 'PortalCard', 'PortalStatusBadge', 'PortalPaymentRing', 'PortalBottomSheet', 'PortalSpendingChart', 'PortalInstallPrompt']) {
    expect(source).toContain(`<${component}`)
  }
})
```

- [ ] **Step 2: Run red** — `npm test -- tests/pages/portal-ui-showcase.spec.ts`; expected: missing component assertions.
- [ ] **Step 3: Implement fixture page** — group inherited shell, controls, information, feedback/data, and interaction demos; use local refs for text inputs and sheet state, fixture invoices for chart, an async no-op refresh callback, and `usePortalToast()` for a demo toast.
- [ ] **Step 4: Run green** — `npm test -- tests/pages/portal-ui-showcase.spec.ts`; expected: PASS.
- [ ] **Step 5: Commit** — `git add app/pages/portal/ui-showcase.vue tests/pages/portal-ui-showcase.spec.ts && git commit -m "feat(portal): showcase portal components"`.

### Task 3: Verify portal-only showcase

**Files:** Modify only Task 1–2 files if verification reveals a defect.

- [ ] **Step 1: Run focused tests** — `npm test -- tests/pages/portal-ui-showcase.spec.ts tests/components/portal/PortalDesignFoundation.spec.ts`; expected: PASS.
- [ ] **Step 2: Run static checks** — `npm run typecheck && npm run lint`; expected: exit 0.
- [ ] **Step 3: Confirm scope** — `git diff --name-only main...HEAD`; expected: route and test only, with no dashboard paths.
