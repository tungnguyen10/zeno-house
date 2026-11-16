---
type: Proposed Capability Delta
title: "add-dashboard-light-mode: spec.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-dashboard-light-mode/specs/ui-dark-theme/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## MODIFIED Requirements

### Requirement: Service table dark theme
`BuildingServiceSettings`, `BuildingServicesMatrix`, and `ContractServicesTab` SHALL use semantic operational tokens consistent with the resolved dashboard theme. Table headers, rows, borders, primary/secondary text, controls, hover, focus, disabled, and error states SHALL remain readable in both light and dark modes.

#### Scenario: BuildingServiceSettings follows dashboard theme
- **WHEN** an admin views building settings in either dashboard theme
- **THEN** the service table uses the corresponding semantic surfaces, borders, and text colors without an appearance-specific utility

#### Scenario: BuildingServicesMatrix follows dashboard theme
- **WHEN** an admin views the building services matrix in light mode
- **THEN** the matrix remains dense and readable with light operational surfaces and visible control boundaries

#### Scenario: ContractServicesTab follows dashboard theme
- **WHEN** an admin views contract services in either dashboard theme
- **THEN** the services table is visually consistent with the surrounding contract detail page
