## ADDED Requirements

### Requirement: Room list pagination
The `/rooms` list page SHALL support pagination matching the buildings list pattern. `useRoomList` SHALL expose `page` (reactive, default 1), `totalPages` (computed), and reset `page` to 1 when filters change. UI shows prev/next buttons when `totalPages > 1`.

#### Scenario: Next page
- **WHEN** user clicks next page button
- **THEN** page increments and list reloads with next page of results

#### Scenario: Filter resets page
- **WHEN** user changes building or status filter
- **THEN** page resets to 1 automatically
