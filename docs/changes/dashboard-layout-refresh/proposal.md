---
type: Change Proposal
title: "dashboard-layout-refresh: proposal.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/dashboard-layout-refresh/proposal.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## Why

The `/dashboard` overview truncates labels at desktop widths, repeats the same data in multiple encodings, draws the annual revenue area chart down to zero for months that have not happened yet, and reuses status colors (warning amber, success green) for revenue categories. Actionable work sits below the analytical revenue section.

## What Changes

- Reorder the page so actionable content comes first: KPI cards, then pending operations and building occupancy, then annual revenue at the bottom.
- Replace the stacked area revenue chart with a stacked column chart; months after the current period render empty instead of zero.
- Remove the redundant category-share bar from the revenue overview and the redundant stacked bar from the collection hero.
- Move the collection month-over-month delta out of the donut center into a readable caption.
- Introduce a theme-aware revenue category palette that does not reuse status colors.
- Give the contracts card the same anatomy as the rooms card and fix a literal color utility in the occupancy list.

## Capabilities

### Modified Capabilities
- `dashboard-ui`: Collection hero delta placement, annual revenue chart type and palette, and responsive reading order.

## Impact

- Affects `app/pages/dashboard/index.vue`, `app/components/dashboard/**`, `app/composables/useChartTheme.ts`, and `app/utils/constants/revenue-categories.ts`.
- No API, database, permission, or route contract changes.
