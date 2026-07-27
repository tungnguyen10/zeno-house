# Invoice Email Recipient Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an invoice as a new delivery when the tenant's current email has no prior delivery, while retaining resend protections for the same recipient.

**Architecture:** The invoice preview drawer already receives the tenant's current recipient email and complete delivery history. It will derive recipient-scoped history using the same trim/lowercase comparison as the persisted recipient values, then select enqueue or resend from that scoped history. No API or database change is required.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils.

## Global Constraints

- Preserve the Zeno House dark operational UI and existing `UiButton`/`UiModal` primitives.
- Do not change the resend RPC: it continues to reject a resend without a prior delivery for the current recipient.
- Normalization at the UI decision boundary is `trim().toLowerCase()` for both current and historical emails.

---

### Task 1: Select the email action by current recipient

**Files:**
- Modify: `tests/components/invoices/InvoiceResponsive.spec.ts`
- Modify: `app/components/invoices/InvoicePreviewDrawer.vue`

**Interfaces:**
- Consumes: `detail.recipientEmail: string | null` and `emailHistory: Ref<InvoiceEmailDelivery[]>`.
- Produces: recipient-scoped action state used by `canStartEmail`, `canResendEmail`, button copy, and `requestEmailAction()`.

- [ ] **Step 1: Write the failing component test**

Add a test with `detail.recipientEmail = 'new-recipient@example.test'` and a delivered history row for `old-recipient@example.test`. It must click **Gửi email** and assert `enqueue` receives `['invoice-1']`, while `resend` is not called.

```ts
expect(sendButton!.text()).toBe('Gửi email')
await sendButton!.trigger('click')
expect(enqueue).toHaveBeenCalledWith(['invoice-1'])
expect(resend).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run tests/components/invoices/InvoiceResponsive.spec.ts --exclude .worktrees/**`

Expected: the assertion fails because the current component labels the action as **Gửi lại email** and calls `resend` for any prior delivery.

- [ ] **Step 3: Implement the minimal recipient-scoped derivation**

In `InvoicePreviewDrawer.vue`, add a local normalization helper and compute `currentRecipientDeliveries` from delivery rows whose normalized `recipientEmail` equals the normalized `detail.recipientEmail`. Base `latestDelivery`, in-flight state, previous-delivery state, resend eligibility, confirmation requirement, and button label on that computed collection. Keep the rendered history unfiltered.

```ts
function normalizeRecipient(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase()
  return normalized || null
}

const currentRecipientDeliveries = computed(() => {
  const recipient = normalizeRecipient(detail.value?.recipientEmail)
  return recipient
    ? emailHistory.value.filter(delivery => normalizeRecipient(delivery.recipientEmail) === recipient)
    : []
})
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run tests/components/invoices/InvoiceResponsive.spec.ts --exclude .worktrees/**`

Expected: the regression test and existing component tests pass for the current workspace; unrelated `.worktrees/**` tests are excluded.

- [ ] **Step 5: Run final relevant checks and commit**

Run: `npm run lint -- app/components/invoices/InvoicePreviewDrawer.vue tests/components/invoices/InvoiceResponsive.spec.ts && npm run typecheck`

Expected: both commands exit 0.

```bash
git add app/components/invoices/InvoicePreviewDrawer.vue tests/components/invoices/InvoiceResponsive.spec.ts docs/superpowers/plans/2026-07-27-invoice-email-recipient-change.md
git commit -m "fix(invoice-email): send newly changed recipients as initial delivery"
```
