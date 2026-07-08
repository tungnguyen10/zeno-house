## Purpose

Defines the catalog of generic UI primitives in `app/components/ui/` — buttons, inputs, modals, badges, alerts, tables, tabs, layout primitives, feedback states, and confirmation surfaces — so domain pages and workflows can be composed from a stable, dark-themed component vocabulary instead of hand-written markup.
## Requirements
### Requirement: UiButton hỗ trợ variant và size
`UiButton` SHALL hỗ trợ `variant` (`primary` | `secondary` | `danger` | `ghost`) và `size` (`sm` | `md` | `lg`). SHALL support `loading` và `disabled` state. SHALL render `<button>` với đúng type attribute. Icon and icon-only usages SHALL be accessible with visible text or an aria-label.

#### Scenario: UiButton render đúng theo variant
- **WHEN** UiButton được render với `variant="primary"`
- **THEN** button có visual style cyan accent consistent with the dark operational theme

#### Scenario: UiButton ghost variant
- **WHEN** UiButton được render với `variant="ghost"`
- **THEN** button has low-emphasis styling suitable for toolbar/icon actions

#### Scenario: UiButton disabled không cho click
- **WHEN** UiButton có prop `disabled` hoặc `loading`
- **THEN** button không nhận click event và có visual style mờ (opacity-50)

#### Scenario: UiButton loading hiển thị spinner
- **WHEN** UiButton có prop `loading="true"`
- **THEN** button hiển thị spinner icon và disabled

#### Scenario: Icon-only button is accessible
- **WHEN** UiButton is used without visible text
- **THEN** it provides an accessible label

### Requirement: UiInput hỗ trợ label, typed input behavior, và field state
`UiInput` SHALL nhận `label`, `modelValue`, `error` (string), `hint`, và `required`. SHALL emit `update:modelValue`. SHALL hiển thị error message bên dưới input khi `error` có giá trị. It SHOULD support stable ids and optional prefix/suffix slots for operational values such as currency, unit, and percent. `class` and `style` SHALL apply to the root wrapper, while native input attributes such as `name`, `autocomplete`, `min`, `max`, `step`, `pattern`, `inputmode`, `readonly`, and `data-*` SHALL reach the native `<input>`.

`UiInput` SHALL support only the native types used by the product: `text`, `email`, `password`, `tel`, `search`, `url`, `date`, and `number`. For `type="number"`, callers SHALL provide `numberMode` (`integer` | `decimal` | `currency` | `meter` | `area` | `month` | `year` | `day` | `percent`) unless the field intentionally uses a custom text-formatting workflow. Caller-provided `min`, `max`, `step`, and `inputmode` SHALL override primitive defaults. Vue model modifiers `.number` and `.trim` SHALL be honored. Domain/page date entry SHOULD use `UiDatePicker` instead of native `UiInput type="date"`.

#### Scenario: UiInput hiển thị label
- **WHEN** UiInput được render với prop `label="Tên tòa nhà"`
- **THEN** `<label>` element hiển thị "Tên tòa nhà" và liên kết với input qua `for`/`id`

#### Scenario: UiInput hiển thị error message
- **WHEN** UiInput có prop `error="Tên tòa nhà là bắt buộc"`
- **THEN** error message hiển thị bên dưới input với màu đỏ, input có border đỏ

#### Scenario: UiInput emit update:modelValue khi người dùng gõ
- **WHEN** người dùng gõ vào UiInput
- **THEN** `update:modelValue` được emit với giá trị mới

#### Scenario: UiInput suffix for unit
- **WHEN** UiInput is used for a meter reading, currency, or percentage field
- **THEN** it can display unit context without custom wrapper markup

#### Scenario: UiInput forwards native attrs
- **WHEN** UiInput receives native attributes such as `name`, `autocomplete`, `min`, `max`, `step`, `pattern`, `inputmode`, `readonly`, or `data-*`
- **THEN** those attributes are available on the native input while wrapper `class`/`style` still style the root component

#### Scenario: UiInput number mode defaults
- **WHEN** UiInput is rendered with `type="number"` and `numberMode="month"`
- **THEN** it defaults to numeric input mode with `min="1"`, `max="12"`, and `step="1"` unless the caller overrides them

#### Scenario: UiInput model modifiers
- **WHEN** UiInput is used with `v-model.number` or `v-model.trim`
- **THEN** emitted values follow Vue modifier semantics instead of always emitting the raw string

#### Scenario: UiInput field state attributes
- **WHEN** UiInput has an error or is disabled
- **THEN** the root exposes `data-invalid` or `data-disabled`, the control exposes `aria-invalid`, and helper/error text is wired through `aria-describedby`

### Requirement: UiDatePicker supports calendar date picking
`UiDatePicker` SHALL provide the standard domain/page date entry control. It SHALL render a button trigger and dark calendar popover, preserve `modelValue` as an ISO `YYYY-MM-DD` string, emit `update:modelValue` and `change`, support `label`, `placeholder`, `error`, `hint`, `required`, `disabled`, compact density, `dateMode`, `minDate`, and `maxDate`, and expose field state consistently with other form primitives.

#### Scenario: Date picker displays selected date
- **WHEN** UiDatePicker receives `modelValue="2026-07-08"`
- **THEN** the trigger displays a localized date label while the emitted value remains `2026-07-08`

#### Scenario: Date picker calendar selection
- **WHEN** a user opens the date picker and selects a date in the calendar
- **THEN** the picker emits the selected ISO date string and closes the popover

#### Scenario: Date picker constraints
- **WHEN** UiDatePicker receives `dateMode`, `minDate`, or `maxDate`
- **THEN** dates outside the effective constraints are disabled unless the caller-provided constraint allows them

#### Scenario: Date picker keyboard and a11y
- **WHEN** UiDatePicker is open
- **THEN** it exposes dialog semantics, visible focus, Escape close, and keyboard navigation across calendar days

### Requirement: UiModal hỗ trợ open/close, accessible title, và focus management
`UiModal` SHALL nhận `open` (boolean), `title` (string), và optional `ariaLabel`. SHALL emit `close` khi người dùng click backdrop hoặc nút close. SHALL dùng `<Teleport to="body">` để render ngoài DOM hierarchy. Each modal SHALL expose an accessible name through visible `title`/`aria-labelledby` or `ariaLabel`, close on Escape, keep Tab focus inside while open, and restore focus to the previously focused element after close.

#### Scenario: UiModal hiển thị khi open=true
- **WHEN** UiModal có prop `open="true"`
- **THEN** modal overlay và dialog box hiển thị

#### Scenario: UiModal ẩn khi open=false
- **WHEN** UiModal có prop `open="false"`
- **THEN** modal không render trong DOM

#### Scenario: UiModal emit close khi click backdrop
- **WHEN** người dùng click vào backdrop (vùng tối xung quanh modal)
- **THEN** event `close` được emit

#### Scenario: UiModal emit close khi click nút X
- **WHEN** người dùng click vào nút đóng (X) của modal
- **THEN** event `close` được emit

#### Scenario: UiModal accessible name
- **WHEN** UiModal is rendered with a title or `ariaLabel`
- **THEN** the dialog has a valid accessible name through `aria-labelledby` or `aria-label`

#### Scenario: UiModal traps and restores focus
- **WHEN** UiModal is open
- **THEN** Tab focus remains inside the modal, Escape requests close, and focus returns to the previous focused element after close

### Requirement: UiStatusBadge hiển thị status với màu sắc tương ứng
`UiStatusBadge` SHALL nhận `status` string và hiển thị với màu sắc khác nhau theo từng trạng thái. SHALL có label tiếng Việt cho từng status. It SHALL cover core entity statuses and billing statuses, with fallback style for unknown values.

#### Scenario: UiStatusBadge hiển thị đúng màu theo status
- **WHEN** UiStatusBadge nhận `status="active"`
- **THEN** badge hiển thị màu semantic success/accent với label tương ứng

#### Scenario: UiStatusBadge không crash với status không xác định
- **WHEN** UiStatusBadge nhận một status value không có trong map
- **THEN** badge hiển thị fallback style (neutral) thay vì throw error

#### Scenario: Billing status labels
- **WHEN** UiStatusBadge receives billing period or invoice statuses
- **THEN** it renders Vietnamese labels and semantic variants for draft, readings, review, issued, collecting, partial, paid, overdue, closed, and void

#### Scenario: Status context disambiguation
- **WHEN** the same status key (e.g. `draft`, `issued`) exists in both billing period and invoice contexts
- **THEN** `UiStatusBadge` accepts an optional `context` (`'entity' | 'period' | 'invoice' | 'correction'`) so the badge picks the matching label/variant from the corresponding map

### Requirement: UiEmptyState hiển thị trạng thái rỗng
`UiEmptyState` SHALL nhận `title` (string), `description` (string, optional), và optional slot `action` cho CTA button. SHALL dùng cho trường hợp list rỗng hoặc không có data.

#### Scenario: UiEmptyState hiển thị title và description
- **WHEN** UiEmptyState được render với `title` và `description`
- **THEN** cả hai text đều hiển thị, centered, với visual icon placeholder

#### Scenario: UiEmptyState hiển thị action button khi được cung cấp
- **WHEN** UiEmptyState có content trong slot `action`
- **THEN** content đó hiển thị bên dưới description

### Requirement: UiSkeleton dùng cho loading placeholder
`UiSkeleton` SHALL nhận `class` để control kích thước. SHALL hiển thị animated shimmer effect. Dùng thay cho spinner khi cần placeholder cho content đang load.

#### Scenario: UiSkeleton hiển thị shimmer animation
- **WHEN** UiSkeleton được render
- **THEN** element hiển thị animated shimmer (pulse hoặc wave effect)

#### Scenario: UiSkeleton nhận class để control kích thước
- **WHEN** UiSkeleton được render với `class="w-full h-4"`
- **THEN** skeleton có đúng kích thước đó

### Requirement: UiConfirmModal component
The system SHALL provide a `UiConfirmModal` component for confirmation dialogs. Props: `open` (boolean), `title` (string), `message` (string), `confirmLabel` (string, default "Xoá"), `loading` (boolean). Emits: `confirm`, `cancel`. Supports optional default slot to override the message with richer HTML content. Used to replace inline delete modal logic in domain detail pages.

#### Scenario: Confirm action
- **WHEN** user clicks the confirm button
- **THEN** component emits `confirm` event

#### Scenario: Cancel action
- **WHEN** user clicks cancel or closes modal
- **THEN** component emits `cancel` event

#### Scenario: Loading state
- **WHEN** `loading` prop is true
- **THEN** confirm button shows loading indicator and is disabled

### Requirement: Select primitive
The system SHALL provide `UiSelect` as the standard select control for forms and toolbars.

#### Scenario: Select with label and options
- **WHEN** `UiSelect` is rendered with label and options
- **THEN** it displays a dark themed select control with label, selected value, and available options

#### Scenario: Select error state
- **WHEN** `UiSelect` receives an error
- **THEN** it renders an error message and error border consistently with `UiInput`

#### Scenario: Select disabled state
- **WHEN** `UiSelect` is disabled
- **THEN** it uses disabled styling and cannot be changed

#### Scenario: Select field state attributes
- **WHEN** `UiSelect` has an error or is disabled
- **THEN** it exposes consistent `data-invalid`, `data-disabled`, `aria-invalid`, and `aria-describedby` state wiring

### Requirement: Textarea primitive
The system SHALL provide `UiTextarea` as the standard multiline text input.

#### Scenario: Textarea with hint
- **WHEN** `UiTextarea` is rendered with a hint
- **THEN** it displays the hint using muted helper text

#### Scenario: Textarea error state
- **WHEN** `UiTextarea` receives an error
- **THEN** it renders an error message and error border consistently with `UiInput`

#### Scenario: Textarea field state attributes
- **WHEN** `UiTextarea` has an error or is disabled
- **THEN** it exposes consistent `data-invalid`, `data-disabled`, `aria-invalid`, and `aria-describedby` state wiring

### Requirement: Boolean controls
The system SHALL provide `UiCheckbox` and `UiToggle` for boolean choices.

#### Scenario: Checkbox for explicit selection
- **WHEN** a form needs a persisted true/false field
- **THEN** it can use `UiCheckbox` with label, disabled state, and error/hint support where needed

#### Scenario: Checkbox field state attributes
- **WHEN** `UiCheckbox` has an error or is disabled
- **THEN** it exposes consistent `data-invalid`, `data-disabled`, `aria-invalid`, and `aria-describedby` state wiring

#### Scenario: Toggle for immediate operational switch
- **WHEN** a settings table needs an on/off switch
- **THEN** it can use `UiToggle` with stable size, dark inactive state, cyan active state, and accessible label

### Requirement: Generic badge primitive
The system SHALL provide `UiBadge` for small semantic labels and status markers.

#### Scenario: Badge variants
- **WHEN** a badge is rendered with neutral, accent, success, warning, or danger variant
- **THEN** it maps to the design system status colors

#### Scenario: Status badge can reuse badge
- **WHEN** `UiStatusBadge` renders a domain status
- **THEN** it can delegate visual styling to `UiBadge` or follow the same variant mapping

### Requirement: Alert primitive
The system SHALL provide `UiAlert` for inline feedback and blockers.

#### Scenario: Error alert
- **WHEN** an API or validation error needs to be shown
- **THEN** `UiAlert` renders a dark themed danger alert with readable text

#### Scenario: Warning blocker
- **WHEN** a billing workflow has missing readings or unsupported pricing
- **THEN** `UiAlert` can render warning/blocker content without custom inline alert classes

### Requirement: Table primitive
The system SHALL provide `UiTable` for operational data tables.

#### Scenario: Dense table
- **WHEN** `UiTable` is rendered in dense mode
- **THEN** it uses compact row height, dark header/body surfaces, dark borders, and readable `text-sm` cells

#### Scenario: Table loading state
- **WHEN** table data is loading
- **THEN** the table renders skeleton or loading rows without layout shift

#### Scenario: Table empty state
- **WHEN** table data is empty
- **THEN** the table renders a consistent empty state

#### Scenario: Numeric alignment
- **WHEN** a column contains currency, totals, readings, or counts
- **THEN** the table supports right-aligned numeric cells

#### Scenario: Action column
- **WHEN** rows expose actions
- **THEN** the table supports a stable action column that does not disrupt row scanning

### Requirement: Tabs primitive
The system SHALL provide `UiTabs` for workspace navigation.

#### Scenario: Tabs render active state
- **WHEN** one tab is active
- **THEN** the active tab is visually distinct using the cyan/accent style

#### Scenario: Tabs support disabled state
- **WHEN** a workflow tab is blocked
- **THEN** the tab can render disabled state and optional reason

### Requirement: Operational layout primitives
The system SHALL provide layout primitives for repeated operational screens.

#### Scenario: Page header
- **WHEN** a page needs title, description, context, and actions
- **THEN** it uses `UiPageHeader`

#### Scenario: Toolbar
- **WHEN** a page needs filters, search, and right-side actions
- **THEN** it uses `UiToolbar`

#### Scenario: Metric
- **WHEN** a workspace needs compact summary values
- **THEN** it uses `UiMetric` rather than dashboard-scale stat cards

#### Scenario: Section
- **WHEN** a page needs a titled content region
- **THEN** it uses `UiSection` for header/content structure without forcing nested cards

### Requirement: Modal and drawer surfaces
The system SHALL standardize modal and optional drawer surfaces for operational actions.

#### Scenario: Modal size variants
- **WHEN** `UiModal` is used for different content sizes
- **THEN** it supports size variants such as sm, md, lg, and xl

#### Scenario: Drawer for dense correction forms
- **WHEN** a workflow needs a dense correction or override form
- **THEN** the system may provide `UiDrawer` or side panel with dark surface styling and clear actions

#### Scenario: Drawer accessible name and focus
- **WHEN** `UiDrawer` is open
- **THEN** it has a visible title or `ariaLabel`, wires `aria-labelledby` when a title exists, closes on Escape, traps Tab focus, and restores previous focus after close

### Requirement: Searchable select primitive
The UI primitive system SHALL provide a searchable selection primitive for choosing an item from a list of domain options such as rooms, tenants, contracts, buildings, invoices, or expense labels. The primitive SHALL support `modelValue`, option identity, option label rendering, `label`, `required`, `disabled`, `loading`, `error`, empty state text, and clear/select behavior. It SHALL optionally support custom typed values when the domain allows a choose-or-type workflow.

#### Scenario: Search filters options
- **WHEN** a user types a query into the searchable select
- **THEN** matching options remain visible and non-matching options are hidden or deprioritized without changing the selected value until the user selects an option

#### Scenario: Selected option is emitted
- **WHEN** a user selects an option from the searchable select
- **THEN** the primitive emits `update:modelValue` with the selected option value and displays the selected option label

#### Scenario: Empty result is visible
- **WHEN** the searchable select has no matching options for the current query
- **THEN** it renders a consistent dark themed empty state instead of an unstyled blank dropdown

#### Scenario: Searchable select error state
- **WHEN** the searchable select receives an error string
- **THEN** it renders the error message and error border consistently with `UiInput` and `UiSelect`

#### Scenario: Searchable select field state attributes
- **WHEN** the searchable select has an error or is disabled
- **THEN** it exposes consistent `data-invalid`, `data-disabled`, `aria-invalid`, and `aria-describedby` state wiring

#### Scenario: Clear action is not nested in trigger
- **WHEN** the searchable select renders a selected value with a clear action
- **THEN** the clear action is not nested inside another button and does not open the dropdown when activated

#### Scenario: Searchable select supports loading
- **WHEN** options are loading
- **THEN** the primitive communicates the loading state and prevents ambiguous selection

#### Scenario: Custom typed option
- **WHEN** the searchable select is configured to allow custom values and the user types a non-empty query that does not match an existing option
- **THEN** it presents a create/use option and emits the typed value through the same selection model

### Requirement: Compact density for form controls
`UiInput`, `UiSelect`, and `UiTextarea` SHALL support compact density in addition to their default size so editable tables, matrix cells, meter readings, and billing review rows can use primitive controls without custom inline classes.

#### Scenario: Compact input in table cell
- **WHEN** `UiInput` is rendered with compact density inside a table cell
- **THEN** it uses reduced padding and stable height while retaining label-less accessibility, focus ring, disabled state, prefix/suffix slots, and error styling

#### Scenario: Compact select in toolbar or table
- **WHEN** `UiSelect` is rendered with compact density
- **THEN** it uses reduced height and padding while preserving placeholder, disabled state, option rendering, error state, and dark select arrow styling

#### Scenario: Compact textarea for dense correction note
- **WHEN** `UiTextarea` is rendered with compact density
- **THEN** it uses compact spacing while preserving resize behavior, error state, and helper text

### Requirement: Primitive-backed icon actions
Icon-only and low-emphasis action buttons SHALL use `UiButton` with `iconOnly` or an equivalent primitive-backed pattern instead of raw `<button>` styling outside primitive internals.

#### Scenario: Accessible icon-only action
- **WHEN** an icon-only action is rendered in the shell, toolbar, row action, or modal header
- **THEN** the action has an accessible label and uses the design-system focus, hover, disabled, and size behavior

#### Scenario: Raw button exception is documented
- **WHEN** a raw `<button>` remains outside `app/components/ui/`
- **THEN** the implementation documents why it is a justified exception or migrates it to `UiButton`

### Requirement: Primitive showcase remains complete
The internal primitive showcase SHALL render every public primitive and every material variant/state added by this change.

#### Scenario: Searchable select showcase
- **WHEN** the searchable select primitive is added
- **THEN** `/ui-showcase` renders examples for normal, selected, loading, empty, disabled, and error states

#### Scenario: Compact density showcase
- **WHEN** compact density is added to form controls
- **THEN** `/ui-showcase` renders compact input, select, and textarea examples in a dense/table-like context
