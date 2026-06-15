# Testing

The project uses Vitest for unit, service, repository, utility, and component tests.

## Commands

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Test Layout

- `tests/server/billing/**`: billing rules, services, permissions, SQL/RLS assertions, audit summaries.
- `tests/server/**`: non-billing repository and service tests.
- `tests/components/**`: Vue component tests with `@vue/test-utils` and `happy-dom`.
- `tests/utils/**`: utility and route helper tests.
- `tests/__fixtures__/billing/**`: deterministic billing builders.
- `tests/__mocks__/**`: Nuxt and Supabase test doubles.

## Conventions

- Keep tests focused on one business rule per case.
- Prefer pure helpers for math/status policy tests.
- Mock repositories at service boundaries.
- Use deterministic fixtures; avoid random data.
- Put fixture overrides close to the assertion so relevant input is visible.

## Current Coverage Focus

Billing has the deepest coverage because it carries the highest financial risk:

- draft calculation and blockers
- invoice status transitions
- period status transitions
- adjustment validation
- payment and bulk-payment behavior
- permission coverage
- audit summary formatting
- SQL/RLS guard assertions

When extending billing, add tests at the rule/service layer first, then add component tests only for meaningful UI state or interaction.
