## Why

The internal sidebar has grown to thirteen flat links, mixing rental operations, financial workflows, and administration in one scan path. Static semantic grouping and consistent Vietnamese labels will make frequent destinations easier to find without adding submenu state or extra clicks.

## What Changes

- Group sidebar links into a standalone Dashboard entry plus static sections for rental assets, finance and operations, and administration.
- Hide empty sections after the existing role-based item filtering is applied.
- Align navigation labels and icons with their destination pages while preserving every route and permission rule.
- Improve active-link semantics, keyboard focus, collapsed-rail accessibility, and mobile touch targets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-shell`: Require grouped, role-aware, accessible sidebar navigation while preserving the existing flat-link interaction model.

## Impact

- Affects the admin shell navigation constants, `AppSidebar`, the audit-history page title, and sidebar tests.
- No API, database, permission, route, dependency, or Pinia contract changes.
