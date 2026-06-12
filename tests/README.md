# Tests

Run the unit and component suite with:

```bash
npm test
npm run test:watch
npm run test:coverage
```

Billing tests prefer pure rule helpers from `server/services/billing/rules.ts` and deterministic fixtures from `tests/__fixtures__/billing/`. Service tests should mock repositories instead of calling Supabase.

The initial `server/services/billing/**` coverage gate is set just below the seeded baseline: branches 16%, functions 15%, lines 16%, statements 15%. Raise these thresholds as more service-level tests are added.

Keep new tests focused on one business rule per case. Use fixture overrides close to the assertion so the relevant input is visible.
