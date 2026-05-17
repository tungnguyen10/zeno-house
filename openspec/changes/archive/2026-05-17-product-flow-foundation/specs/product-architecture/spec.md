## MODIFIED Requirements

### Requirement: Product architecture document
The `openspec/specs/product-architecture/spec.md` SHALL serve as the living source of truth for the layered platform model. It SHALL define: the 5-layer architecture (Foundation → Core Data → Operational Workspaces → Tenant Experience → Automation), domain boundaries for each entity (Building, Room, Tenant, Contract), what each layer MUST NOT contain, and the correct operational mindset (workspace-scoped billing, not room-centric billing). The document SHALL also reflect a v0.2.5 foundation phase that prepares Core Data for billing workspace work before any billing runtime features are introduced.

#### Scenario: Architecture document accessible
- **WHEN** a developer opens the spec
- **THEN** they can read the complete domain boundary definitions, the v0.2.5 foundation framing, and the flow diagrams

#### Scenario: Room boundary violation detectable
- **WHEN** a developer proposes adding billing/invoice state to a Room page
- **THEN** the spec clearly states Room MUST NOT contain monthly utility history, invoice state, payment state, or billing calculations

#### Scenario: Foundation phase is visible
- **WHEN** a developer reads the roadmap section
- **THEN** the roadmap shows a core-data alignment foundation before the monthly billing workspace change set