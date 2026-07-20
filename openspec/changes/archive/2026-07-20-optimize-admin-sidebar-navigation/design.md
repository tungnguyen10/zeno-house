## Context

`AppSidebar` currently receives a flat `NavItem[]`, filters items by role inside the component, and renders one list. The desktop shell can collapse to a 64px icon rail while mobile always opens a full-width drawer. The change must preserve this public prop, route matching, role rules, dark/cyan/Inter design system, and existing store state.

## Goals / Non-Goals

**Goals:**

- Make thirteen destinations faster to scan by exposing their product relationships.
- Keep every destination one click away and remove empty role-filtered groups.
- Give active, focused, collapsed, and touch interactions explicit accessible behavior.
- Keep navigation labels and icons consistent with destination meaning.

**Non-Goals:**

- No collapsible submenus, new navigation state, route changes, or permission changes.
- No new primitive, icon asset, token, dependency, or design-system change.
- No changes to the tenant portal navigation.

## Decisions

1. Add a required `section: NavSectionKey` to each `NavItem` and define ordered `NAV_SECTIONS` metadata. `AppSidebar` continues to accept `navItems?: NavItem[]`; it maps the visible items into the canonical section order and removes empty sections.
2. Keep Dashboard in a label-free primary section, followed by three labelled sections: `Tài sản & cho thuê`, `Tài chính & vận hành`, and `Quản trị`. This avoids a redundant “Tổng quan / Dashboard” pair while retaining one data model.
3. Reuse `isNavItemVisible` as the single presentation filter instead of duplicating its conditions in the component. Server authorization remains authoritative.
4. Render section labels only in the expanded desktop sidebar and mobile drawer. The collapsed desktop rail uses section separators and keeps link text available to assistive technology.
5. Use existing Tailwind tokens and icon assets. Add `aria-current="page"`, visible focus, pressed feedback, restrained colour transitions, and mobile-sized targets directly to the shell link.

## Risks / Trade-offs

- [Additional section labels increase vertical height] → Keep compact spacing, retain the existing independently scrollable navigation region, and hide labels in the collapsed rail.
- [Custom `navItems` props could render an unknown section] → Make `section` a typed required field so invalid data fails during type checking.
- [Role filtering could leave empty headings] → Build sections after filtering and omit sections whose item list is empty.
- [Renamed labels may break text-based tests] → Update component tests to assert the new user-facing vocabulary and section behavior.
