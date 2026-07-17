## 1. Design foundation (tokens & scales)

- [ ] 1.1 Refine `.portal-shell` CSS variables in `app/assets/scss/main.scss` (title `#0B1422`, body `#5B6472`, add muted `#8A93A3`, primary `#1554F0`, primary-soft `#EAF0FF`, canvas `#F4F6FB`, border `#E6E9EF`, positive `#0E9F6E`, warning `#B7791F`, danger `#E02424`, plus two elevation tokens)
- [ ] 1.2 Verify/add Tailwind color aliases in `tailwind.config.ts` for any new semantic tokens (e.g. `text-muted`, positive/warning/danger) without editing generated `app/types/database.types.ts`
- [ ] 1.3 Add portal type-scale + money utility classes (tabular-nums, tracking, currency-unit styling) scoped under `.portal-shell` in `app/assets/scss/main.scss`, only where Tailwind cannot express them
- [ ] 1.4 Confirm portal color/body contrast meets WCAG AA against portal surfaces

## 2. Shared component refresh

- [ ] 2.1 `PortalCard.vue`: standardize padding/radius/elevation and add optional status `accent` prop rendering the 3px hairline (paid/due/overdue)
- [ ] 2.2 `PortalInvoiceStatusBadge.vue` + request status badge: drive color/label from one shared status-to-style map (positive/warning-accent/danger)
- [ ] 2.3 `PortalButton.vue`: align variants with new primary, ensure `focus-visible` ring, enforce `aria-label` for icon-only buttons
- [ ] 2.4 `PortalTextField.vue`: align focus/error styling with tokens and make it the single form field primitive
- [ ] 2.5 `PortalEmptyState.vue` + `PortalSkeleton.vue`: clarify empty-vs-error visuals; align skeleton shapes with refreshed layouts
- [ ] 2.6 `PortalHeader.vue` + `PortalTabBar.vue`: refine spacing, active indicator, safe-area padding, and back/close `aria-label`s

## 3. Page application

- [ ] 3.1 `app/pages/portal/index.vue`: apply type scale + spacing rhythm; render latest-invoice hero with money statement treatment and status accent
- [ ] 3.2 `app/pages/portal/invoices/index.vue`: statement-style rows with tabular amounts, unified status badges, refreshed skeleton/empty
- [ ] 3.3 `app/pages/portal/invoices/[id].vue`: statement summary header; replace nested-card breakdown with divider-separated key-value rows; payment summary + notes
- [ ] 3.4 `app/pages/portal/room.vue`: room/contract card and lease terms as clean divider-separated rows
- [ ] 3.5 `app/pages/portal/requests.vue`: list rows + bottom-sheet create form using `PortalTextField` with unified validation feedback
- [ ] 3.6 `app/pages/portal/profile.vue`: profile edit form via `PortalTextField`; polish identity/document upload slots and logout

## 4. Motion & accessibility polish

- [ ] 4.1 Tune press/page micro-interactions within `prefers-reduced-motion`
- [ ] 4.2 Verify visible `focus-visible` affordances across all interactive portal elements

## 5. Verification

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 Run portal-related tests: `npx vitest run tests/components tests/pages`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 Manual browser pass at `https://localhost:3000/portal` across all six pages in loading/empty/error/data states, mobile viewport with safe areas, and reduced-motion
- [ ] 5.5 `openspec validate refresh-tenant-portal-ui --strict`
