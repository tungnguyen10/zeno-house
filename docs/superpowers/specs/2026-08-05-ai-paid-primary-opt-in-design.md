# Paid AI Primary Opt-In Design

## Goal

Allow production AI chat to use an explicitly configured paid OpenRouter primary model, such as `deepseek/deepseek-v4-flash-0731`, without weakening the existing protection against implicit paid fallback routing.

## Runtime Contract

Add the private server variable `NUXT_AI_ALLOW_PAID_PRIMARY`, defaulting to `false`.

- When `false`, production behavior remains unchanged: primary and fallback model IDs must both end in `:free`.
- When `true`, the configured primary may be paid, but the configured fallback must still end in `:free`.
- Primary and fallback must remain distinct.
- The flag is private runtime configuration and must not be exposed through `runtimeConfig.public` or returned to the browser.
- OpenRouter continues receiving only the single explicitly configured fallback. The change does not enable implicit paid fallback or router-selected paid models.

The intended production configuration is:

```env
NUXT_AI_PROVIDER=openrouter
NUXT_AI_MODEL=deepseek/deepseek-v4-flash-0731
NUXT_AI_MODEL_FALLBACK=google/gemma-4-31b-it:free
NUXT_AI_ALLOW_PAID_PRIMARY=true
```

## Validation And Failure Behavior

Runtime validation will fail before provider invocation when any of these conditions holds:

- a paid primary is configured without the opt-in flag;
- the fallback is not an explicit `:free` model;
- primary and fallback are identical.

The deployment catalog verifier will read the same flag. It will require both configured model IDs to exist and support tools, require zero prompt/completion pricing for the fallback, and require zero pricing for the primary only when paid-primary opt-in is disabled. Its success output will describe the routing without claiming that the whole route is zero-cost.

## Files And Requirements

The implementation will update:

- `nuxt.config.ts` and `server/services/ai/provider.ts` for the private flag and runtime policy;
- `scripts/verify-ai-models.mjs` for catalog validation consistent with runtime behavior;
- focused provider-routing and verifier tests using test-first red/green steps;
- the active `harden-ai-billing-assistant-flow` OpenSpec delta, tasks, architecture documentation, and rollout guide so the accepted behavior no longer claims all production primaries are always free.

No database, API shape, UI, action execution, or Supabase migration changes are required.

## Verification

Verification will cover:

1. Production rejects a paid primary when the opt-in flag is absent or false.
2. Production accepts a paid primary when the flag is true and fallback is free.
3. Production rejects a paid fallback even when paid primary is allowed.
4. Production still rejects duplicate models.
5. Catalog verification accepts a priced, tool-capable primary only with opt-in and continues requiring a zero-cost, tool-capable fallback.
6. Focused AI tests, typecheck, lint for changed files, and OpenSpec validation pass.

## Rollout

Set the three model variables and `NUXT_AI_ALLOW_PAID_PRIMARY=true` in the Vercel Production environment, run the catalog verifier with those exact values, and redeploy. If the flag is removed or set to false later, the server fails closed before making a paid request.
