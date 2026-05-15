## ADDED Requirements

### Requirement: Dashboard summary endpoint
`GET /api/dashboard/summary` SHALL return aggregate stats for the entire system in a single response. Response shape:
```ts
{
  buildings: { total: number }
  rooms: { total: number; available: number; occupied: number; maintenance: number }
  tenants: { total: number }
  contracts: { active: number }
  buildingBreakdown: Array<{
    id: string
    name: string
    rooms: { total: number; available: number; occupied: number; maintenance: number }
  }>
}
```
Requires authentication. Admin and manager roles can access.

#### Scenario: Stats returned correctly
- **WHEN** admin calls GET /api/dashboard/summary
- **THEN** returns 200 with correct counts for buildings, rooms by status, tenants, active contracts

#### Scenario: Building breakdown included
- **WHEN** multiple buildings exist with rooms of different statuses
- **THEN** buildingBreakdown array contains one entry per building with correct room counts

#### Scenario: Empty system
- **WHEN** no data exists
- **THEN** returns all counts as 0, buildingBreakdown as empty array

#### Scenario: Unauthenticated request
- **WHEN** request has no auth token
- **THEN** returns 401 UNAUTHENTICATED
