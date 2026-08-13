## Purpose

Theme-aware design-system requirements for service-related UI components. The historical capability path is retained while the UI supports both dashboard themes.

## Requirements

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
