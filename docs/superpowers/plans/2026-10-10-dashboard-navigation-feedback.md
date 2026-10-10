# Dashboard Navigation Feedback Implementation Plan

> **For agentic workers:** Implement one checklist item at a time, with a failing behavioral test before each code change.

**Goal:** A single tap anywhere in `/dashboard/**` visibly starts navigation or opens a detail drawer, and every asynchronous destination presents loading feedback without requiring a second tap.

**Architecture:** A dashboard-scoped navigation state records the activated source until the destination renders or navigation fails. Nuxt's existing loading indicator handles route progress; each destination owns its skeleton and error state. Detail drawers open before fetching. The dashboard shell owns inner-scroll restoration.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind CSS, Vitest.

## Global Constraints

- Keep portal and auth navigation behavior intact; do not install dependencies or start a local runtime without explicit approval.
- Preserve semantic light/dark dashboard colors, focus visibility, reduced motion, and link semantics.
- Only interactive elements gain pending feedback; checkbox selection and read-only rows remain separate.
- Static pages without initial asynchronous data need no skeleton.

---

### Task 1: Route-level feedback

**Files:** `app/app.vue`, `app/utils/dashboard-navigation-feedback.ts`, `app/plugins/dashboard-navigation.client.ts`, dashboard navigation components, focused tests.

- [x] Add a failing test for one-click pending state, cancelled navigation, and fast second navigation.
- [x] Implement shared source/target state and clear it when the new page renders or navigation fails.
- [x] Fix loading-indicator color, set an immediate throttle, and wire pending visuals into route links and programmatic navigation buttons throughout `/dashboard/**`.
- [x] Verify the test, then inspect the dashboard route inventory for uncovered navigation sources.

### Task 2: Detail drawers and destination skeletons

**Files:** `app/components/billing/BillingPaymentsStep.vue`, `app/components/invoices/InvoicePreviewDrawer.vue`, dashboard pages with blocking initial fetches, focused tests.

- [x] Test that a detail drawer opens before its API resolves, shows a skeleton, and offers retry after failure.
- [x] Open data-backed drawers synchronously; guard against stale responses after close or selection change.
- [x] Audit every dashboard page: retain existing skeletons, add skeletons only for asynchronous content with no placeholder, and make blocking detail fetches lazy where the page already has a loading branch.
- [x] Verify focused tests and the billing-list-to-workspace source path.

### Task 3: Inner-scroll restoration

**Files:** `app/app.vue` or a dashboard-only client composable/plugin, focused tests.

- [x] Save positions by browser history entry; reset new routes after render, restore on Back/Forward, and preserve position for query/hash updates.
- [x] Keep cancelled navigation and drawer open/close from resetting scroll.

### Task 4: Requirements and verification

**Files:** relevant operational UI and invoice-browse specs, UI pattern documentation.

- [x] Record the navigation and drawer loading contract in the existing specs and docs.
- [x] Run focused tests, `openspec validate --specs`, `npm run typecheck`, `npm test`, and `npm run lint`.
- [ ] Visually inspect representative mobile and desktop routes when the running dev server responds.
