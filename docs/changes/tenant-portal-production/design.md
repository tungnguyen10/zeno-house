---
type: Design
title: "Tenant portal mobile and production design"
status: draft
tags: [tenant, portal, architecture, pwa]
---

# Design

## Navigation and hierarchy

Preserve the five portal destinations and the existing portal tokens/Inter typography. Use a compact
room identity, then a complete outstanding balance and one prioritized invoice action. Invoice
history and spending charts are secondary. Controls use comfortable touch targets, readable fields,
safe-area spacing, visible focus and reduced motion. Refresh keeps valid content on screen.

## Finance

Invoice pagination returns true metadata. The server computes financialSummary over the entire
authorized scope, independently of the first page. Voided/nonpayable invoices never enter debt totals.
Payable invoices are prioritized by overdue obligations and the earliest due date. Monthly chart
math excludes void invoices and groups active invoices by billing month before averaging.
Invoice details expose only safe payment fields and whitelisted utility snapshot evidence.

## Support

Requests open a full-detail bottom sheet. Attachment-signing failure degrades the attachment only.
Staff update status and a deliberately public response using an atomic database function with an
expected update timestamp. Reply text is never treated as a payment record or canonical identity edit.
Drafts stay in memory and navigation/update controls guard against accidental loss.

## Privacy

All business reads continue through server-scoped APIs. Direct authenticated reads on contracts,
occupants and invoices are revoked together with unused direct support-request mutation grants.
Service-role access remains intact. Portal async-data keys include the Auth identity and are cleared
on account change/sign-out. Signed links remain ephemeral. Official contract files are limited to
the current primary tenant; roommates cannot obtain files containing another person's legal dossier.

## PWA

Keep one role-aware PWA with start URL `/`. Static assets and a generic offline page may be cached;
authenticated HTML, tenant APIs and signed storage URLs must not be cached. A new worker waits for
an explicit update action and does not reload an active form automatically. Reconnection refreshes
read data; failed writes require explicit user retry.
