---
type: Change Proposal
title: "Tenant portal production and mobile PWA"
status: draft
tags: [tenant, portal, pwa, production]
---

# Tenant portal production and mobile PWA

The 2026-11-27 review identified truncated invoice history, incomplete debt prioritization,
misleading legacy invoice states, direct table access bypassing portal response whitelists,
and unfinished support feedback.
The user requested implementation to complete the tenant portal for production with a mobile-first PWA experience.

## Outcome

Tenants can understand all outstanding debt, inspect bills and recorded payments, use issued
contract documents within their authorized role, submit and read support requests with public replies,
and recover safely from connection/account errors on a phone or installed PWA.

## Scope

- Complete server-scoped invoice pagination and financial summary; correct monthly chart math.
- Read-only payment history and persisted utility calculation evidence.
- Debt-first home and mobile invoice actions, explicit loading/error/empty states.
- Full support detail and private evidence, public staff response with atomic concurrent updates.
- Session-scoped async-data keys and safe account switching/logout.
- Close unnecessary direct table access that can bypass portal response whitelists.
- Current primary-tenant access to issued/signed official contract documents.
- Install/update/offline/reconnect behavior that preserves drafts and never caches personal data.

## Boundaries

No automatic payment recognition is inferred from a tenant message. Existing staff payment records
remain authoritative. Roommate, active housing, profile whitelist and identity correction rules remain
in force. No offline queue of financial writes, new chat subsystem, new design system or native app.
Database migration and authenticated deployment verification are separate release requirements.
