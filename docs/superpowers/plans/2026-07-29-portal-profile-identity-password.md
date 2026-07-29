# Portal Profile Identity and Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tenants update their CCCD details and images from the profile edit screen, and change their password from a dedicated security screen linked from the profile view.

**Architecture:** Extend the existing strict profile-update whitelist through the shared Zod schema, service, repository, optimistic DTO mapping, and changed-only form helper. Keep identity-image mutations on their existing tenant-scoped API/composable, but move controls to edit while the dossier remains read-only. Add a separate tenant-scoped password endpoint that verifies `current_password` through Supabase Auth, emits a credential-free audit event, and is consumed by a dedicated portal page.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Zod 4, Supabase Auth (`@supabase/supabase-js` 2.105.4), TailwindCSS, Vitest, OpenSpec.

## Global Constraints

- Work directly on `main` as explicitly requested; do not create a worktree or feature branch.
- Preserve the existing portal light/dark token system, Inter typography, page rhythm, safe areas, and `Portal*` primitives.
- Browser business data must continue through `server/api/**`; no browser-side Supabase table queries.
- Password values must never enter application tables, logs, error details, or audit payloads.
- Profile updates remain changed-only, normalized, self-scoped, permission-checked, and audited.
- Identity-image upload/removal remains immediate per side and independent from the text-form save action.
- Do not edit generated `app/types/database.types.ts`.
- Vietnamese user-facing copy must include correct diacritics.

---

### Task 1: Update Accepted Requirements and Active Change

**Files:**
- Modify: `openspec/changes/refresh-tenant-portal-ui/proposal.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/design.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/specs/tenant-portal-ui/spec.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`
- Modify: `openspec/specs/tenant-portal-api/spec.md`
- Modify: `openspec/specs/user-auth/spec.md`
- Modify: `docs/features/tenant-portal.md`
- Modify: `docs/features/authentication.md`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-29-portal-profile-redesign-design.md`.
- Produces: normative requirements for 12-field profile editing, edit-only identity-image controls, profile security action, and current-password-verified password changes.

- [ ] **Step 1: Add failing spec expectations**

Add scenarios equivalent to:

```markdown
#### Scenario: Tenant updates identity details
- **WHEN** a tenant submits a unique CCCD number, issue date, or issue place
- **THEN** only changed normalized fields are persisted and audited

#### Scenario: Tenant opens password security
- **WHEN** a tenant chooses `Đổi mật khẩu` from `/portal/profile`
- **THEN** `/portal/profile/password` requires current password, new password, and confirmation
```

- [ ] **Step 2: Update the active task list**

Append:

```markdown
## 9. Tenant identity and password self-service

- [ ] 9.1 Extend the tenant profile whitelist with unique CCCD details and changed-only reconciliation
- [ ] 9.2 Move identity-image controls to profile edit and keep view previews read-only
- [ ] 9.3 Add profile security action and current-password-verified password route
- [ ] 9.4 Verify focused tests, typecheck, lint, OpenSpec, full regression, and affected UI states
```

- [ ] **Step 3: Validate artifacts**

Run:

```bash
openspec validate refresh-tenant-portal-ui --strict
openspec validate --specs
```

Expected: active change valid; all accepted specs valid.

- [ ] **Step 4: Commit**

```bash
git add openspec docs/features
git commit -m "docs(portal): specify identity and password self-service"
```

---

### Task 2: Extend the Profile Identity Whitelist

**Files:**
- Modify: `app/utils/validators/tenant-portal.ts`
- Modify: `app/utils/portal-profile.ts`
- Modify: `app/composables/tenant-portal/usePortalProfile.ts`
- Modify: `server/services/tenant-portal/profile.ts`
- Test: `tests/utils/portal-profile.test.ts`
- Test: `tests/server/tenant-portal/core.test.ts`
- Test: `tests/server/tenant-portal/services.test.ts`
- Test: `tests/composables/tenant-portal.test.ts`

**Interfaces:**
- Consumes: `TenantRepository.findByIdNumber(event, idNumber, excludeId)`.
- Produces: `TenantProfileUpdateInput` with optional `id_number`, `id_issued_date`, and `id_issued_place`; `TenantProfileEditForm` with matching string fields.

- [ ] **Step 1: Write failing validator and normalization tests**

Add assertions:

```ts
expect(tenantProfileUpdateSchema.parse({
  id_number: ' 012345678901 ',
  id_issued_date: '2020-01-02',
  id_issued_place: ' Cục Cảnh sát QLHC về TTXH ',
})).toEqual({
  id_number: '012345678901',
  id_issued_date: '2020-01-02',
  id_issued_place: 'Cục Cảnh sát QLHC về TTXH',
})
```

and changed-only form assertions for all three fields, including blank-to-`null`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts tests/server/tenant-portal/core.test.ts
```

Expected: FAIL because identity keys are stripped/not present in the form model.

- [ ] **Step 3: Extend schema, form model, normalization, and optimistic mapping**

Add:

```ts
id_number: z.string().trim().max(20, 'Số CCCD/CMND quá dài').nullable().optional(),
id_issued_date: isoDateSchema,
id_issued_place: z.string().trim().max(200, 'Nơi cấp quá dài').nullable().optional(),
```

Map snake-case updates to `idNumber`, `idIssuedDate`, and `idIssuedPlace` in `applyOptimistic`.

- [ ] **Step 4: Write failing duplicate-service test**

Mock `TenantRepository.findByIdNumber` and assert a different tenant produces HTTP 409 with:

```ts
{
  fieldErrors: {
    id_number: ['Số CCCD/CMND đã tồn tại'],
  },
}
```

- [ ] **Step 5: Run service test to verify RED**

Run:

```bash
npx vitest run tests/server/tenant-portal/services.test.ts
```

Expected: FAIL because the service does not check identity conflicts.

- [ ] **Step 6: Add the minimal conflict check**

Before persistence:

```ts
if (whitelisted.id_number) {
  const conflict = await TenantRepository.findByIdNumber(
    event,
    whitelisted.id_number,
    id,
  )
  if (conflict) {
    throwConflict('Số CCCD/CMND đã tồn tại', {
      fieldErrors: { id_number: ['Số CCCD/CMND đã tồn tại'] },
    })
  }
}
```

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts tests/server/tenant-portal/core.test.ts tests/server/tenant-portal/services.test.ts tests/composables/tenant-portal.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 8: Mark 9.1 complete and commit**

```bash
git add app/utils app/composables/tenant-portal/usePortalProfile.ts server/services/tenant-portal/profile.ts tests openspec/changes/refresh-tenant-portal-ui/tasks.md
git commit -m "feat(portal): allow tenant identity updates"
```

---

### Task 3: Move Identity Image Controls Into Profile Edit

**Files:**
- Modify: `app/components/portal/PortalIdentityImageSlot.vue`
- Modify: `app/pages/portal/profile/index.vue`
- Modify: `app/pages/portal/profile/edit.vue`
- Modify: `app/components/portal/PortalProfileDossier.vue`
- Test: `tests/components/portal/PortalIdentityImageSlot.spec.ts`
- Test: `tests/components/portal/PortalProfileDossier.spec.ts`
- Test: `tests/pages/portal-profile-ui.spec.ts`

**Interfaces:**
- Consumes: `usePortalIdentityImages()` and its `images`, `uploading`, `progress`, `upload`, and `remove` members.
- Produces: `PortalIdentityImageSlot` prop `editable?: boolean` with default `true`.

- [ ] **Step 1: Write failing read-only slot and page tests**

Assert:

```ts
const wrapper = mount(PortalIdentityImageSlot, {
  props: { label: 'Mặt trước', signedUrl: '/front.jpg', editable: false },
})
expect(wrapper.find('input[type="file"]').exists()).toBe(false)
expect(wrapper.find('button').exists()).toBe(false)
expect(wrapper.find('img').exists()).toBe(true)
```

Page-source tests must expect 11 `PortalInput` controls, identity image events on edit, no identity mutation handlers on view, and a security link to `/portal/profile/password`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run tests/components/portal/PortalIdentityImageSlot.spec.ts tests/pages/portal-profile-ui.spec.ts
```

Expected: FAIL because `editable` and the three identity inputs do not exist.

- [ ] **Step 3: Add the read-only slot mode**

When `editable === false`, render the image/empty preview and label only. Do not render file input,
replace button, remove button, or interactive drop/capture affordances.

- [ ] **Step 4: Extend the edit page**

Add three fields:

```vue
<PortalInput v-model="form.id_number" label="Số CCCD/CMND" inputmode="numeric" />
<PortalInput v-model="form.id_issued_date" label="Ngày cấp" type="date" />
<PortalInput v-model="form.id_issued_place" label="Nơi cấp" />
```

Add front/back `PortalIdentityImageSlot` controls using the existing composable. Identity-image
uploads remain outside the text submit payload and do not alter `dirty`.

- [ ] **Step 5: Make the profile view read-only and add Security action**

Use `:editable="false"` for both image slots. Add one calm `Bảo mật` row/card containing:

```vue
<NuxtLink to="/portal/profile/password">Đổi mật khẩu</NuxtLink>
```

Rename dossier copy from management-only wording to `Thông tin định danh`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx vitest run tests/components/portal/PortalIdentityImageSlot.spec.ts tests/components/portal/PortalProfileDossier.spec.ts tests/pages/portal-profile-ui.spec.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Run focused Hallmark polish**

Check 320/375/414/768-width source constraints: no wrapping action labels, two-column image layout
only from `sm`, 44px controls, fixed feedback space, visible focus, disabled/uploading states, and
reduced motion.

- [ ] **Step 8: Mark 9.2 complete and commit**

```bash
git add app/components/portal app/pages/portal/profile tests openspec/changes/refresh-tenant-portal-ui/tasks.md
git commit -m "feat(portal): edit tenant identity images"
```

---

### Task 4: Add Current-Password-Verified Password Change

**Files:**
- Modify: `app/utils/validators/tenant-portal.ts`
- Modify: `app/components/portal/PortalInput.vue`
- Create: `app/composables/tenant-portal/usePortalPassword.ts`
- Create: `app/pages/portal/profile/password.vue`
- Modify: `server/repositories/users.ts`
- Create: `server/services/tenant-portal/password.ts`
- Create: `server/api/tenant/password.post.ts`
- Test: `tests/utils/tenant-password.test.ts`
- Test: `tests/components/portal/PortalInput.spec.ts`
- Test: `tests/composables/portal-password.test.ts`
- Test: `tests/server/tenant-portal/password.test.ts`
- Test: `tests/pages/portal-password-ui.spec.ts`

**Interfaces:**
- Produces: `tenantPasswordChangeSchema` and `TenantPasswordChangeInput`.
- Produces: `UserRepository.updateCurrentPassword(event, password, currentPassword?)`.
- Produces: `TenantPasswordService.change(event, user, input): Promise<void>`.
- Produces: `usePortalPassword().change(input): Promise<boolean>`.

- [ ] **Step 1: Write failing password validator tests**

Required behavior:

```ts
expect(tenantPasswordChangeSchema.safeParse({
  current_password: 'old-password',
  password: 'new-password',
  password_confirmation: 'different',
}).success).toBe(false)
```

Also reject fewer than 8 or more than 72 characters and identical old/new passwords.

- [ ] **Step 2: Write failing repository/service tests**

Assert Supabase receives:

```ts
updateUser({
  password: 'new-password',
  current_password: 'old-password',
})
```

Assert `invalid_credentials` becomes `Mật khẩu hiện tại không đúng`, `same_password` remains a safe
validation error, and the audit call contains no request body or password fields.

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npx vitest run tests/utils/tenant-password.test.ts tests/server/tenant-portal/password.test.ts tests/server/users/user-repository-auth.test.ts
```

Expected: FAIL because the schema/service/endpoint and current-password repository argument do not exist.

- [ ] **Step 4: Implement validator and server flow**

Use:

```ts
const { error } = await client.auth.updateUser({
  password,
  ...(currentPassword ? { current_password: currentPassword } : {}),
})
```

The service permission-checks the tenant update capability, resolves the tenant ID, updates Auth,
and appends `AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_CHANGED` with actor/tenant/building metadata only.

- [ ] **Step 5: Write failing portal field/composable/page tests**

Assert `PortalInput` with `type="password"` and `revealable` toggles between password/text without
changing the model, the composable POSTs to `/api/tenant/password`, and the page has three fields
with correct autocomplete attributes plus shared saving/error state.

- [ ] **Step 6: Run UI tests to verify RED**

Run:

```bash
npx vitest run tests/components/portal/PortalInput.spec.ts tests/composables/portal-password.test.ts tests/pages/portal-password-ui.spec.ts
```

Expected: FAIL because revealable password behavior and the route do not exist.

- [ ] **Step 7: Implement portal password UI**

Enhance `PortalInput` with a `revealable?: boolean` prop valid for password inputs. Add an
accessible icon button with labels `Hiện mật khẩu` / `Ẩn mật khẩu`, 44px target, visible focus, and
no model mutation.

The password page uses:

```vue
<PortalInput type="password" revealable autocomplete="current-password" />
<PortalInput type="password" revealable autocomplete="new-password" />
<PortalInput type="password" revealable autocomplete="new-password" />
```

On success, clear all fields, show `Đã đổi mật khẩu.`, and navigate to `/portal/profile` while
keeping the current session active.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npx vitest run tests/utils/tenant-password.test.ts tests/components/portal/PortalInput.spec.ts tests/composables/portal-password.test.ts tests/server/tenant-portal/password.test.ts tests/server/users/user-repository-auth.test.ts tests/pages/portal-password-ui.spec.ts
```

Expected: all selected tests pass.

- [ ] **Step 9: Mark 9.3 complete and commit**

```bash
git add app server tests openspec/changes/refresh-tenant-portal-ui/tasks.md
git commit -m "feat(portal): add secure password change"
```

---

### Task 5: Documentation, Regression, and Final Polish

**Files:**
- Modify: `docs/features/tenant-portal.md`
- Modify: `docs/features/authentication.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`

**Interfaces:**
- Consumes: completed identity, image, and password flows.
- Produces: current documentation and verified implementation.

- [ ] **Step 1: Update developer documentation**

Document the 12 editable profile fields, duplicate-ID behavior, edit-only image controls,
`/portal/profile/password`, current-password verification, active-session behavior, and
credential-free audit event.

- [ ] **Step 2: Run focused regression**

```bash
npx vitest run tests/utils/portal-profile.test.ts tests/utils/tenant-password.test.ts tests/components/portal tests/composables/tenant-portal.test.ts tests/composables/portal-password.test.ts tests/server/tenant-portal tests/pages/portal-profile-ui.spec.ts tests/pages/portal-password-ui.spec.ts
```

Expected: all selected tests pass.

- [ ] **Step 3: Run static verification**

```bash
npm run typecheck
npm run lint
openspec validate refresh-tenant-portal-ui --strict
openspec validate --specs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Run full regression in a clean test root**

Run the full suite from a worktree/root that does not contain sibling `.worktrees/**` directories,
because root Vitest discovery otherwise includes unrelated worktree tests.

```bash
npm test
```

Expected: all project tests pass.

- [ ] **Step 5: Final Hallmark audit**

Audit profile view, identity edit, image upload/remove, password default/error/saving/success,
light/dark, 320/375/414/768 widths, focus visibility, touch targets, safe areas, overflow, and
reduced motion. Record any unavailable browser/runtime verification honestly.

- [ ] **Step 6: Mark 9.4 complete only when verification is complete**

Do not mark the pre-existing broad manual task 5.4 complete unless all six portal pages and states
were actually inspected.

- [ ] **Step 7: Commit**

```bash
git add docs openspec
git commit -m "docs(portal): document identity and password flows"
```

