# AI Chat Suggestions Design

## Goal

Expose every operator-facing task currently supported by the AI Billing Assistant in the empty-chat starter area, so users can discover and launch valid prompts without memorizing commands.

## Scope

Change only the empty state in `AppAiDevChat.vue` and its component tests. Preserve the existing chat layout, dark/cyan design system, message flow, action-card confirmation flow, permissions, and runtime feature gates.

## Information Architecture

Render all suggestions at once inside the existing scrollable message region, grouped under three compact labels:

### Kỳ billing

- Mở kỳ billing hiện tại.
- Xem tổng quan kỳ billing.
- Tính và giải thích billing draft.

### Chỉ số

- Kiểm tra tiến độ nhập chỉ số điện nước.
- Hướng dẫn nhập chỉ số hàng loạt từ các dòng dữ liệu người dùng sẽ dán vào chat.
- Sửa một chỉ số đã nhập.
- Điều chỉnh mức tiêu thụ điện nước của một phòng.

### Hóa đơn

- Xem trước và phát hành hóa đơn.
- Ghi thu một hoặc nhiều phòng, bao gồm tất cả phòng còn nợ khi người dùng yêu cầu.
- Huỷ một hóa đơn chưa thu.
- Phát hành lại một hóa đơn đã huỷ.
- Điều chỉnh một hóa đơn đã thu hoặc thu một phần.

Internal helper tools such as user-context lookup and building listing are not shown as standalone operator tasks; the assistant invokes them automatically when resolving scope.

## Interaction

Each suggestion remains a full-width button using the existing `onSuggestion` path. Clicking a suggestion copies its prompt into the current send flow and immediately sends it. Prompts request the intended operation but leave building, room, period, invoice, and pasted meter values for the user or assistant clarification instead of inventing identifiers.

The list remains visible only when the transcript is empty. During sending, every suggestion stays disabled through the existing state. The current scroll container absorbs the additional height, so the composer and widget dimensions remain unchanged.

## Permissions And Errors

Suggestions are discovery affordances, not authorization. Server tool policy, role capabilities, building scope, and runtime kill switches remain authoritative. If a user selects an unavailable task, the assistant returns the existing scoped permission or availability response; the UI does not bypass or duplicate server policy.

## Testing

- Add a component regression test asserting the three group labels and every supported operator task are rendered in the empty state.
- Assert internal helper tools are not exposed as suggestions.
- Assert clicking a representative new suggestion uses the existing send path.
- Run the focused component test, typecheck, full test suite, lint, and OpenSpec validation if accepted requirements are updated.

## Non-goals

- No new AI tool, API, database migration, runtime flag, or permission rule.
- No collapsible groups, search, carousel, or redesign of the chat widget.
- No fabricated building, room, invoice, billing-period, or meter-reading identifiers.
