---
type: Historical Design
title: "2026-07-29-portal-invoice-latest-order-design"
status: deprecated
archive_state: historical
tags: [superpowers, history, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/specs/2026-07-29-portal-invoice-latest-order-design.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Historical Superpowers design/execution record. The document is preserved for provenance and is not a second accepted specification. For current rules, use `docs/capabilities/**` and `docs/changes/**`.

# Portal Invoice Latest-First Ordering Design

## Goal

Ensure `/portal/invoices` always presents billing periods from latest to oldest even when the tenant API returns invoices in a different order.

## Ordering Contract

- Latest is determined by billing period, not payment or publication dates.
- Compare `periodYear` descending first.
- Within a year, compare `periodMonth` descending.
- Invoices with the same year and month retain their original relative order.
- The input array from `usePortalInvoices()` is never mutated.

The resulting ledger therefore renders year groups from newest to oldest and months within each year from newest to oldest.

## Implementation Boundary

The existing `groupTenantInvoicesByYear()` presentation helper will copy and sort the input before grouping it. The portal invoice page continues consuming the same helper and needs no layout or interaction changes.

This change does not modify:

- tenant API ordering or data contracts;
- invoice detail behavior;
- dashboard surfaces;
- MapTrack light/dark tokens, typography, spacing, or primitives;
- loading, empty, error, pull-to-refresh, status, or navigation behavior.

## Verification

- Helper tests cover unordered years and months, stable ordering for the same period, and input immutability.
- Page tests prove rendered year groups and invoice rows are latest-first even when composable data is unordered.
- The accepted tenant portal UI requirement is updated to make latest-first billing-period sorting explicit.
- Focused tests, OpenSpec validation, typecheck, lint, and the full test suite must pass before local merge to `main`.
