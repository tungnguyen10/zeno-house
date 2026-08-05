# Paid AI Primary Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an explicitly opted-in paid OpenRouter primary model in production while preserving a free-only explicit fallback.

**Architecture:** Add one private runtime boolean that is consumed by provider configuration validation and by the deployment catalog verifier. Keep OpenRouter fallback options unchanged so only the configured free fallback can be selected after the primary. Update the active OpenSpec delta and operational docs to make the cost boundary explicit.

**Tech Stack:** Nuxt 4 runtime config, TypeScript, OpenRouter-compatible AI SDK routing, Vitest, OpenSpec.

## Global Constraints

- `NUXT_AI_ALLOW_PAID_PRIMARY` is private server configuration and defaults to `false`.
- A paid production primary is valid only when `NUXT_AI_ALLOW_PAID_PRIMARY=true`.
- The fallback must always be an explicit `:free` model with zero catalog pricing.
- Primary and fallback must remain distinct and support tool calling.
- Do not change OpenRouter's explicit fallback list, privacy options, API shape, database schema, or UI.

---

### Task 1: Runtime Paid-Primary Policy

**Files:**
- Modify: `tests/server/ai/provider-routing.test.ts`
- Modify: `server/services/ai/provider.ts`
- Modify: `nuxt.config.ts`

**Interfaces:**
- Consumes: Nuxt private runtime values `aiModel`, `aiModelFallback`, and new `aiAllowPaidPrimary`.
- Produces: `AiProviderConfig.allowPaidPrimary: boolean` and production validation that permits only the primary to be paid when explicitly opted in.

- [ ] **Step 1: Write failing runtime tests**

Add separate cases proving that a paid primary is rejected by default, accepted with `aiAllowPaidPrimary: true`, and that a paid fallback remains rejected with the flag enabled:

```ts
expect(() => resolveAiProviderConfig(runtime({
  aiModel: 'deepseek/deepseek-v4-flash-0731',
}), true)).toThrow(/paid primary|free/i)

expect(resolveAiProviderConfig(runtime({
  aiModel: 'deepseek/deepseek-v4-flash-0731',
  aiAllowPaidPrimary: true,
}), true).allowPaidPrimary).toBe(true)

expect(() => resolveAiProviderConfig(runtime({
  aiAllowPaidPrimary: true,
  aiModelFallback: 'deepseek/deepseek-v4-flash-0731',
}), true)).toThrow(/fallback.*free/i)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/server/ai/provider-routing.test.ts`

Expected: FAIL because `aiAllowPaidPrimary` is not resolved and the paid primary still triggers the existing free-only production guard.

- [ ] **Step 3: Implement minimal runtime support**

Add `aiAllowPaidPrimary?: unknown` to the runtime-like input, `allowPaidPrimary: boolean` to `AiProviderConfig`, parse it strictly as `=== true`, and replace the production guard with distinct primary and fallback checks. Add this private runtime config entry:

```ts
aiAllowPaidPrimary: process.env.NUXT_AI_ALLOW_PAID_PRIMARY === "true",
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/server/ai/provider-routing.test.ts`

Expected: all provider-routing tests pass.

### Task 2: Deployment Catalog Verification

**Files:**
- Modify: `tests/scripts/verify-ai-models.test.ts`
- Modify: `scripts/verify-ai-models.mjs`

**Interfaces:**
- Consumes: `NUXT_AI_ALLOW_PAID_PRIMARY`, configured primary/fallback IDs, and OpenRouter catalog entries.
- Produces: `validateModelCatalog(models, primary, fallback, allowPaidPrimary)` and a neutral `Verified AI routing` success message.

- [ ] **Step 1: Write failing verifier tests**

Add tests showing that a non-zero-price, tool-capable primary passes only when `allowPaidPrimary` is true, while a priced fallback always fails:

```ts
expect(validateModelCatalog([
  model(primary, '0.000001'),
  model(fallback),
], primary, fallback, true)).toEqual({ primary, fallback, allowPaidPrimary: true })

expect(() => validateModelCatalog([
  model(primary, '0.000001'),
  model(fallback, '0.000001'),
], primary, fallback, true)).toThrow(/fallback.*zero-cost/i)
```

- [ ] **Step 2: Run the verifier test and verify RED**

Run: `npm test -- --run tests/scripts/verify-ai-models.test.ts`

Expected: FAIL because the verifier has no opt-in argument and still requires both models to be zero-cost.

- [ ] **Step 3: Implement verifier policy**

Parse `NUXT_AI_ALLOW_PAID_PRIMARY === 'true'`, require fallback `:free` plus zero pricing, require primary zero pricing only without opt-in, and continue requiring both catalog entries and tool support. Change CLI success text from `Verified zero-cost AI routing` to `Verified AI routing` and include whether paid-primary opt-in is enabled.

- [ ] **Step 4: Run the verifier test and verify GREEN**

Run: `npm test -- --run tests/scripts/verify-ai-models.test.ts`

Expected: all verifier tests pass.

### Task 3: Requirements And Rollout Documentation

**Files:**
- Modify: `openspec/changes/harden-ai-billing-assistant-flow/proposal.md`
- Modify: `openspec/changes/harden-ai-billing-assistant-flow/design.md`
- Modify: `openspec/changes/harden-ai-billing-assistant-flow/specs/ai-agent-foundation/spec.md`
- Modify: `openspec/changes/harden-ai-billing-assistant-flow/tasks.md`
- Modify: `docs/architecture/ai-agent.md`
- Modify: `docs/development/ai-billing-assistant-rollout.md`

**Interfaces:**
- Consumes: the runtime and verifier behavior from Tasks 1–2.
- Produces: accepted requirement and deployment instructions for explicit paid-primary opt-in with a free fallback.

- [ ] **Step 1: Update the active delta and architecture language**

Replace the absolute free-only-primary requirement with: production defaults to free-only; a paid primary requires the private opt-in; fallback remains explicitly free; implicit paid fallback remains prohibited. Add a completed checklist item for this policy adjustment to the active change tasks.

- [ ] **Step 2: Update rollout configuration and release gate**

Document:

```env
NUXT_AI_MODEL=deepseek/deepseek-v4-flash-0731
NUXT_AI_MODEL_FALLBACK=google/gemma-4-31b-it:free
NUXT_AI_ALLOW_PAID_PRIMARY=true
```

State that the verifier must be run with the exact deployment environment and that removing the opt-in fails closed before provider invocation.

- [ ] **Step 3: Validate requirements**

Run: `openspec validate harden-ai-billing-assistant-flow --strict`

Expected: the active change validates with no errors.

### Task 4: Final Verification

**Files:**
- Verify all files changed by Tasks 1–3.

**Interfaces:**
- Consumes: completed runtime, verifier, tests, and docs.
- Produces: evidence that the repository is ready for the Vercel environment update and redeployment.

- [ ] **Step 1: Run focused AI tests**

Run: `npm test -- --run tests/server/ai/provider-routing.test.ts tests/scripts/verify-ai-models.test.ts tests/server/ai/chat-provider-errors.test.ts`

Expected: all focused test files pass with zero failures.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint -- --no-warn-ignored server/services/ai/provider.ts tests/server/ai/provider-routing.test.ts scripts/verify-ai-models.mjs tests/scripts/verify-ai-models.test.ts nuxt.config.ts`

Expected: exit code 0.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only scoped implementation/spec/documentation files are modified.
