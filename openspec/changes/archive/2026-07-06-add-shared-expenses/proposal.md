## Why

Owners who run multiple buildings share some costs across them, such as a security guard who watches two buildings or a shared management fee. Today each building's expenses are entered independently, so a shared cost must be split by hand and duplicated per building every period, which is tedious and easy to get wrong. This change lets an owner define a shared expense once and allocate it evenly across selected buildings, generating a normal building expense in each so every building's operations report reflects its share.

## What Changes

- Add owner-scoped shared expenses that apply across multiple buildings the owner controls.
- Support even split allocation across the selected buildings (equal shares only in this change).
- Add an allocate action that generates one building expense per selected building for a chosen period, each carrying its allocated share.
- Add a dedicated `/shared-expenses` page for owners to manage shared expenses and run allocation.
- Add capabilities: shared read/write/allocate, granted to admin/owner only; managers do not see shared expenses.

## Capabilities

### New Capabilities

- `shared-expenses`: Owner-scoped shared expense definitions, even-split allocation across buildings, per-building expense generation, permissions, and scope enforcement.

### Modified Capabilities

- None.

## Impact

- Database: new `shared_expenses` and `shared_expense_buildings` tables with indexes and RLS safety policies; regenerated database types.
- Server: new repositories, services, validators, mappers, and API routes; allocation generates rows in `building_expenses`.
- Client: new `/shared-expenses` page and composable with an allocation preview.
- Docs/specs: new shared-expenses capability; updates to API, database, and auth-permissions docs.
