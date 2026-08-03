# AI Chat Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every operator-facing AI Billing Assistant task in a grouped, clickable empty-chat starter list.

**Architecture:** Keep suggestion data and rendering local to `AppAiDevChat.vue`. Replace the flat string list with three typed groups while retaining the existing `onSuggestion(text)` send path and scroll container. Cover the full rendered inventory and click behavior through the existing component test.

**Tech Stack:** Nuxt 4 compatibility mode, Vue 3 `<script setup>`, TypeScript, TailwindCSS, Vitest, Vue Test Utils.

## Global Constraints

- Preserve the current dark/cyan widget design, dimensions, composer, transcript, and action-card behavior.
- Show operator-facing tasks only; do not expose `get_user_context` or `list_buildings` as standalone suggestions.
- Do not add AI tools, APIs, database migrations, dependencies, permissions, or runtime flags.
- Suggestion prompts must not invent building, room, invoice, billing-period, or meter-reading identifiers.
- Clicking a suggestion must continue to send immediately through `onSuggestion` and respect `sending` disabled state.

---

### Task 1: Group And Render The Complete Suggestion Inventory

**Files:**
- Modify: `tests/components/app/AppAiDevChat.test.ts`
- Modify: `app/components/app/AppAiDevChat.vue`

**Interfaces:**
- Consumes: existing `onSuggestion(text: string): Promise<void>` and `sending: Ref<boolean>`.
- Produces: local `suggestionGroups: ReadonlyArray<{ label: string; suggestions: ReadonlyArray<{ id: string; text: string }> }>` rendered only when `messages.length === 0`.

- [x] **Step 1: Write the failing empty-state inventory test**

Extend the `useAiChat` mock factory so a test can mount an empty transcript. Assert these group labels:

```ts
expect(wrapper.text()).toContain('Kỳ billing')
expect(wrapper.text()).toContain('Chỉ số')
expect(wrapper.text()).toContain('Hóa đơn')
```

Assert one visible prompt for every supported operator task:

```ts
const expectedSuggestions = [
  'Mở kỳ billing hiện tại.',
  'Xem tổng quan kỳ billing hiện tại.',
  'Tính và giải thích billing draft kỳ hiện tại.',
  'Kiểm tra tiến độ nhập chỉ số điện nước kỳ hiện tại.',
  'Tôi muốn nhập hàng loạt chỉ số điện nước; hãy yêu cầu tôi dán dữ liệu.',
  'Sửa một chỉ số điện nước đã nhập.',
  'Điều chỉnh mức tiêu thụ điện nước của một phòng.',
  'Xem trước và phát hành hóa đơn kỳ hiện tại.',
  'Ghi thu các phòng còn nợ kỳ hiện tại.',
  'Huỷ một hóa đơn chưa ghi thu.',
  'Phát hành lại một hóa đơn đã huỷ.',
  'Điều chỉnh một hóa đơn đã ghi thu hoặc ghi thu một phần.',
]
for (const suggestion of expectedSuggestions) expect(wrapper.text()).toContain(suggestion)
expect(wrapper.text()).not.toContain('get_user_context')
expect(wrapper.text()).not.toContain('list_buildings')
```

- [x] **Step 2: Write the failing click-path test**

Click the new payment suggestion and verify the existing chat composable receives the prompt and calls `send` once:

```ts
await wrapper.get('[data-testid="ai-suggestion-record-payments"]').trigger('click')
expect(prompt.value).toBe('Ghi thu các phòng còn nợ kỳ hiện tại.')
expect(send).toHaveBeenCalledOnce()
```

- [x] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/components/app/AppAiDevChat.test.ts
```

Expected: FAIL because the three group labels and new suggestion buttons are absent.

- [x] **Step 4: Implement grouped suggestions**

Replace the flat `suggestions` array with:

```ts
const suggestionGroups = [
  {
    label: 'Kỳ billing',
    suggestions: [
      { id: 'open-period', text: 'Mở kỳ billing hiện tại.' },
      { id: 'period-overview', text: 'Xem tổng quan kỳ billing hiện tại.' },
      { id: 'calculate-draft', text: 'Tính và giải thích billing draft kỳ hiện tại.' },
    ],
  },
  {
    label: 'Chỉ số',
    suggestions: [
      { id: 'meter-status', text: 'Kiểm tra tiến độ nhập chỉ số điện nước kỳ hiện tại.' },
      { id: 'meter-import', text: 'Tôi muốn nhập hàng loạt chỉ số điện nước; hãy yêu cầu tôi dán dữ liệu.' },
      { id: 'meter-update', text: 'Sửa một chỉ số điện nước đã nhập.' },
      { id: 'usage-override', text: 'Điều chỉnh mức tiêu thụ điện nước của một phòng.' },
    ],
  },
  {
    label: 'Hóa đơn',
    suggestions: [
      { id: 'issue-invoices', text: 'Xem trước và phát hành hóa đơn kỳ hiện tại.' },
      { id: 'record-payments', text: 'Ghi thu các phòng còn nợ kỳ hiện tại.' },
      { id: 'void-invoice', text: 'Huỷ một hóa đơn chưa ghi thu.' },
      { id: 'reissue-invoice', text: 'Phát hành lại một hóa đơn đã huỷ.' },
      { id: 'adjust-paid-invoice', text: 'Điều chỉnh một hóa đơn đã ghi thu hoặc ghi thu một phần.' },
    ],
  },
] as const
```

Render each group with a compact `text-[10px] font-semibold uppercase tracking-wide text-muted` label and keep each suggestion as the existing full-width button. Add `` :data-testid="`ai-suggestion-${suggestion.id}`" `` for stable interaction tests.

- [x] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- tests/components/app/AppAiDevChat.test.ts
```

Expected: all `AppAiDevChat` tests pass.

- [x] **Step 6: Run repository verification**

Run:

```bash
npm run typecheck
npm test
npm run lint
```

Expected: each command exits 0 with no failed tests or lint errors.

- [x] **Step 7: Commit**

```bash
git add app/components/app/AppAiDevChat.vue tests/components/app/AppAiDevChat.test.ts docs/superpowers/plans/2026-08-03-ai-chat-suggestions.md
git commit -m "feat(ai): show complete assistant task suggestions"
```
