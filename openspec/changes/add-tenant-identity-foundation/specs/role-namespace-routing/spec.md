## MODIFIED Requirements

### Requirement: Two isolated route namespaces
The app SHALL organize authenticated routes into exactly two namespaces: `/portal/**` for the `tenant` role, and `/dashboard/**` for internal roles (`admin`, `owner`, `manager`). The API surface SHALL mirror this isolation: `/api/tenant/**` is reserved for the `tenant` role, and internal `/api/**` is reserved for internal roles. The server namespace guard SHALL enforce both directions.

#### Scenario: Tenant JWT blocked from internal API
- **WHEN** a `tenant`-role JWT calls an internal `/api/**` endpoint
- **THEN** the server rejects it with a consistent forbidden/not-found response

#### Scenario: Internal role blocked from tenant API
- **WHEN** an `admin`/`owner`/`manager` JWT calls a `/api/tenant/**` endpoint
- **THEN** the server rejects it

#### Scenario: Internal roles use dashboard namespace
- **WHEN** an `admin`, `owner`, or `manager` navigates to an internal feature
- **THEN** the route lives under `/dashboard/**`

#### Scenario: Portal namespace reserved for tenant
- **WHEN** a route under `/portal/**` is requested
- **THEN** only a `tenant`-role user may render it; all other roles are redirected out
