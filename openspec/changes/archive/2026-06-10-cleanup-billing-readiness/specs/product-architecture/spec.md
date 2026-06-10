## MODIFIED Requirements

### Requirement: Product architecture document
The `openspec/specs/product-architecture/spec.md` SHALL serve as the living source of truth for the layered platform model. It SHALL define: the 5-layer architecture (Foundation → Core Data → Operational Workspaces → Tenant Experience → Automation), domain boundaries for each entity (Building, Room, Tenant, Contract), what each layer MUST NOT contain, and the correct operational mindset (workspace-scoped billing, not room-centric billing). The document SHALL reflect that monthly billing work is scoped by Building + Period, utility readings are billing inputs, and monthly invoice settlement belongs to invoice/payment allocation rather than contract master data.

#### Scenario: Architecture document accessible
- **WHEN** a developer opens the spec
- **THEN** they can read the complete domain boundary definitions, the v0.2.5 foundation framing, and the flow diagrams

#### Scenario: Room boundary violation detectable
- **WHEN** a developer proposes adding monthly billing entry, invoice state, payment state, or billing calculations to a Room page
- **THEN** the spec clearly states Room MUST NOT host monthly billing work

#### Scenario: Read-only room context allowed
- **WHEN** a developer proposes showing compact read-only meter or contract context on Room detail
- **THEN** the spec allows it only if the user is directed to the Monthly Billing Workspace for monthly entry and calculation

#### Scenario: Monthly payment boundary clear
- **WHEN** a developer proposes recording monthly invoice settlement directly as contract master data
- **THEN** the spec states monthly settlement belongs to invoice/payment allocation once billing runtime exists

