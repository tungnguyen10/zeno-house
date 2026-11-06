# Portal Profile Figma Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose `/portal/profile` to match the Figma account layout while retaining portal light/dark tokens and all current behavior.

**Architecture:** Keep route orchestration in `app/pages/portal/profile/index.vue` and profile-field
presentation in `PortalProfileDossier.vue`. Reuse existing portal primitives and SVG icon
components; no data-layer or design-system changes are needed.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, TailwindCSS, Vitest, Vue Test Utils.

## Global Constraints

- Preserve every current profile field and action.
- Preserve `/portal/profile/edit` and `/portal/profile/password`.
- Keep identity-image mutations on the edit route.
- Use existing portal theme tokens for both light and dark modes.
- Do not add dependencies, tokens, fonts, primitives, or inline SVG.
- Keep Vietnamese copy fully accented.
- Verify 320, 375, 414, and 768 pixel widths.

---

### Task 1: Figma-Aligned Dossier

**Files:**
- Modify: `tests/components/portal/PortalProfileDossier.spec.ts`
- Modify: `app/components/portal/PortalProfileDossier.vue`

**Interfaces:**
- Consumes: `TenantProfile`.
- Produces: the existing `PortalProfileDossier` component with Figma-aligned identity and groups.

- [ ] **Step 1: Write the failing component expectations**

Assert that the rendered dossier contains `Sửa thông tin`, links to `/portal/profile/edit`, uses the
five Figma group labels, and renders icon-led headings while retaining all DTO values.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/components/portal/PortalProfileDossier.spec.ts
```

Expected: FAIL because the current dossier has no inline `Sửa thông tin` action and combines profile
groups inside a different card hierarchy.

- [ ] **Step 3: Implement the dossier**

Recompose the identity block as a centered avatar/name/code/status stack. Add the pill-shaped edit
link. Render each group as its own icon-led section and `PortalCard`, using divider-separated rows
and portal token-backed text/surface classes.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run tests/components/portal/PortalProfileDossier.spec.ts
```

Expected: all dossier tests pass.

### Task 2: Figma-Aligned Profile Sections

**Files:**
- Modify: `tests/pages/portal-profile-ui.spec.ts`
- Modify: `app/pages/portal/profile/index.vue`

**Interfaces:**
- Consumes: `PortalProfileDossier`, identity images, documents, security link, and logout action.
- Produces: the Figma vertical account-page rhythm without changing behavior.

- [ ] **Step 1: Write failing page-source expectations**

Assert that editing is owned by the dossier rather than a teleported header action, identity images
stack by default, and security/documents/logout use icon-led Figma-style sections.

- [ ] **Step 2: Run the focused page test and verify RED**

Run:

```bash
npx vitest run tests/pages/portal-profile-ui.spec.ts
```

Expected: FAIL because the current page teleports the edit action and renders identity images in a
two-column mobile grid.

- [ ] **Step 3: Implement the route presentation**

Remove the teleported edit control, keep `setChrome({ title: 'Tài khoản', back: null })`, and align
the identity image, security, document, and logout surfaces with the Figma vertical rhythm. Preserve
all loading, error, upload, removal, focus, and logout behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/components/portal/PortalProfileDossier.spec.ts tests/pages/portal-profile-ui.spec.ts
```

Expected: all selected tests pass.

### Task 3: Verification and Polish

**Files:**
- Verify all files changed by Tasks 1–2.

**Interfaces:**
- Produces: evidence that the implementation is type-safe, lint-clean, and visually coherent.

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: exit code 0.

- [ ] **Step 4: Inspect the diff**

Confirm there are no API/data/theme-token changes, no inline SVG, no horizontal-overflow-prone
fixed widths, and no loss of loading/error/action states.

