## Purpose

Dark theme design system tokens for service-related UI components. Ensures BuildingServiceSettings, BuildingServicesMatrix, and ContractServicesTab are consistent with the rest of the app's dark design.

## Requirements

### Requirement: Service table dark theme
`BuildingServiceSettings`, `BuildingServicesMatrix`, và `ContractServicesTab` SHALL use the dark design system tokens consistent with the rest of the app. Table headers SHALL use `bg-dark-surface` or `bg-dark-card`, table body rows `bg-dark-surface`, borders `border-dark-border`, text `text-white` for primary and `text-muted` for secondary. Input fields SHALL use `bg-dark-surface border-dark-border text-white focus:ring-cyan/30`.

#### Scenario: BuildingServiceSettings renders in dark theme
- **WHEN** admin views /buildings/:id/settings
- **THEN** service table has dark background, dark borders, white text — no light gray backgrounds visible

#### Scenario: BuildingServicesMatrix renders in dark theme
- **WHEN** admin views /buildings/:id/settings matrix section
- **THEN** matrix table has dark background, no bg-white or bg-gray-50 classes

#### Scenario: ContractServicesTab renders in dark theme
- **WHEN** admin views /contracts/:id services section
- **THEN** services table has dark background consistent with surrounding contract detail page
