---
type: Design Record
title: "2026-07-27-invoice-email-recipient-change-design"
description: "Migrated Superpowers design record; supporting context, not an accepted capability specification."
status: deprecated
authority: supporting
migration_origin: "docs/superpowers/specs/2026-07-27-invoice-email-recipient-change-design.md"
tags: [superpowers, design, migrated]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/specs/2026-07-27-invoice-email-recipient-change-design.md"
generated: { by: "process:okf-migration", at: "2026-11-06T00:00:00Z" }
---

# Invoice email recipient change

## Problem

The invoice preview treats any prior delivery as evidence that the next action is a resend. When a tenant's email changes, all prior deliveries belong to the old recipient. The resend RPC deliberately requires a prior delivery for the current normalized recipient, so it rejects the request with `INVOICE_EMAIL_NO_PREVIOUS_DELIVERY`.

## Decision

Determine the action from deliveries for the current recipient email only. A delivery is associated with the current recipient when its email matches after trimming and lowercasing.

- No delivery for the current recipient: show **Gửi email** and use the normal enqueue endpoint.
- A current-recipient delivery exists: retain the existing resend, duplicate-confirmation, and in-flight rules.
- Continue displaying the complete delivery history, including deliveries to former recipient addresses.

## Boundaries

This is a UI state-selection fix in the invoice preview drawer. The resend RPC remains unchanged: direct resend requests for an address without a prior delivery continue to be rejected.

## Verification

Add a component test with a current recipient different from the latest historical delivery. The test must assert that the action is the initial-send path and that the resend endpoint is not invoked.
