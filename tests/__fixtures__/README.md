# Test Fixtures

Billing fixtures live in `tests/__fixtures__/billing/` and expose deterministic builder functions.

Use builders with small overrides near the assertion:

```ts
const invoice = buildInvoice({ paidAmount: 500_000 })
```

Defaults should be valid business records. Tests should override only the fields relevant to the rule being exercised.
