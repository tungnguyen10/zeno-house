# Billing Mobile Selection Layout

## Problem

The mobile draft card renders its checkbox, room identity, and save status as three independent children of a `justify-between` header. When save status is empty, the room identity sits near the visual center and becomes disconnected from the checkbox that selects it.

## Approved Design

Group the checkbox and room identity into one left-aligned cluster. Keep save status as the only right-aligned header item.

- The checkbox keeps its 44 px touch target and accessible room-specific label.
- Room number, tenant name, and draft total remain in their current typography and order.
- Selected cards keep the existing cyan border/surface treatment.
- Save states (`Đang lưu…`, `Đã lưu ✓`, `Lỗi`) remain at the right edge.
- Cards without a visible save state do not reserve a third distribution column.
- No API, selection-state, permission, or issue-flow behavior changes.

## Component Boundary

Only `BillingMobileDraftRow.vue` changes. Its existing props and emitted `select` event remain unchanged; the fix is limited to template grouping and layout utilities.

## Responsive and Accessibility Checks

- Verify the left cluster stays aligned at 320, 375, 414, and 768 px.
- Tenant names may truncate or wrap within the available content column without pushing the checkbox away.
- The checkbox remains keyboard-focusable and at least 44 × 44 px on touch screens.
- Save status stays readable without overlapping the room identity.

## Testing

- Extend the billing draft-grid component regression test to assert that the mobile card header contains a left cluster with the checkbox and room identity.
- Run the focused component test, scoped ESLint, and Nuxt typecheck.
