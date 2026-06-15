# Product Architecture

> Living document — update this spec when domain boundaries change.

## Purpose
Defines the platform architecture, domain boundaries, operational workspace model, and architectural decisions that guide product changes.

## Platform Layers

```
Layer 5 — Automation          Scheduled jobs: invoice generation, reminders, escalation
Layer 4 — Tenant Experience   Tenant portal: view invoices, pay, submit requests
Layer 3 — Operational Workspaces  Monthly Billing Workspace (Building + Period scoped)
Layer 2 — Core Data           Buildings, Rooms, Tenants, Contracts
Layer 1 — Foundation          Auth, permissions, server infrastructure
```

## Domain Boundaries

### Building
- **Is**: Master configuration for a property: address, room count, billing defaults
- **Contains**: Name, address, status, billing config (billing_day, due_day, rates, fees)
- **Must NOT contain**: List of invoices, payment state, utility readings

### Room
- **Is**: A rentable unit inside a Building
- **Contains**: Room number, floor, monthly rent, area, status, current occupant
- **Must NOT contain**: Monthly utility history, invoice state, payment state, billing calculations

### Tenant
- **Is**: A person who signs contracts
- **Contains**: Personal info, contact details, active contract references
- **Must NOT contain**: Invoice history (those belong to billing workspace)

### Contract
- **Is**: The legal link between Tenant ↔ Room for a period and the commercial truth for billing
- **Contains**: Start date, end date, monthly rent, deposit, status, occupant count, discount, surcharge, commercial notes, renewal chain (`previous_contract_id`, `renewal_count`), and contract-level payment records (deposit paid, prepaid rent)
- **Must NOT contain**: Invoice state (invoices reference contracts; contracts don't embed invoices)

### Utility Reading
- **Is**: A meter snapshot (electricity/water) for a Room at a point in time
- **Belongs to**: Monthly Billing Workspace — entered during a billing run, not on the Room page
- **Must NOT appear**: In Room detail page as CRUD history

### Invoice (future)
- **Is**: The monthly charge document for a Contract
- **Belongs to**: Monthly Billing Workspace
- **Scoped by**: Building + billing period

## Operational Workspace Model

All billing/invoicing workflows are **workspace-scoped** (Building + Period), not room-centric.

```
User selects Building + Month  →  Billing Workspace opens
  ├── Enter utility readings for all rooms
  ├── Review charges (rent + utilities + service fees)
  ├── Generate invoices (batch or per room)
  └── Track payments
```

**Key rule**: A user never navigates to a Room page to do billing work. The Room page is for master data management only.

## v0.2.5 Roadmap — Core Data Alignment

These changes prepare Core Data to support the Monthly Billing Workspace cleanly, without carrying forward ambiguities into v0.3.

```
F0.2.5.1  Building Operational Config               ✅  product-flow-foundation
F0.2.5.2  Quick Room Setup                          ✅  product-flow-foundation
F0.2.5.3  Contract Commercial Terms                 ✅  product-flow-foundation
F0.2.5.4  Occupants / Roommates Model               ✅  product-flow-foundation
F0.2.5.5  Meter Device Lifecycle                    ✅  product-flow-foundation
F0.2.5.6  Navigation Alignment                      ✅  product-flow-foundation
F0.2.5.7  Architecture ADRs                         ✅  product-flow-foundation
F0.2.5.8  Contract Payments / Deposit / Prepaid Rent 🔲  contract-payments
F0.2.5.9  Contract Renewal Model                    🔲  contract-renewal
```

## Architecture Decision Records

### ADR-001: Room Is Operational Anchor, Not Billing Workspace

**Decision**: Room pages are master data screens only. Users never navigate to a Room page to perform billing work.

**Rationale**: Scoping billing to Room creates a per-room workflow that breaks down when a landlord needs to process an entire building at once. The Monthly Billing Workspace is scoped to Building + Period, not Room.

---

### ADR-002: Billing Is Workspace-Based, Not Room-Detail-Based

**Decision**: All billing workflows live inside a workspace scoped to Building + Period. Utility readings are entered in bulk, invoices are generated in batch, payments are tracked per workspace.

**Rationale**: This matches real rental operations where landlords process all rooms in a building monthly, not room by room.

---

### ADR-003: Building Is Operational Container

**Decision**: Building stores not just address data but also billing defaults (pricing types, rates, schedule), owner/contact info, and operational metadata. These defaults cascade to rooms and contracts as fallbacks.

**Rationale**: Every operational decision about a property (when to bill, at what rate, by what schedule) is tied to the building, not to individual rooms.

---

### ADR-004: Utility Readings Are Billing Inputs, Not Room Metadata

**Decision**: Utility readings belong to the Monthly Billing Workspace. They are inputs to a billing run, not a historical log attached to a room.

**Rationale**: A utility reading has meaning only in the context of a billing period. Attaching it permanently to a Room page confuses operational data (current meter state) with billing history.

---

### ADR-005: Contracts Are Commercial Truth For Billing

**Decision**: The Contract record is the source of truth for rent amount, deposit, occupant count, and commercial terms. Room default rent is a fallback only.

**Rationale**: Billing must be able to snapshot terms as of a specific period. Using room defaults instead of contract terms creates inconsistency when room defaults change.

## Requirements

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
