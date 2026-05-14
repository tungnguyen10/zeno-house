## ADDED Requirements

### Requirement: UiButton hỗ trợ variant và size
`UiButton` SHALL hỗ trợ `variant` (`primary` | `secondary` | `danger`) và `size` (`sm` | `md` | `lg`). SHALL support `loading` và `disabled` state. SHALL render `<button>` với đúng type attribute.

#### Scenario: UiButton render đúng theo variant
- **WHEN** UiButton được render với `variant="primary"`
- **THEN** button có visual style xanh (bg-blue-600 hoặc tương đương)

#### Scenario: UiButton disabled không cho click
- **WHEN** UiButton có prop `disabled` hoặc `loading`
- **THEN** button không nhận click event và có visual style mờ (opacity-50)

#### Scenario: UiButton loading hiển thị spinner
- **WHEN** UiButton có prop `loading="true"`
- **THEN** button hiển thị spinner icon và disabled

---

### Requirement: UiInput hỗ trợ label và error state
`UiInput` SHALL nhận `label`, `modelValue`, `error` (string), và `required`. SHALL emit `update:modelValue`. SHALL hiển thị error message bên dưới input khi `error` có giá trị.

#### Scenario: UiInput hiển thị label
- **WHEN** UiInput được render với prop `label="Tên tòa nhà"`
- **THEN** `<label>` element hiển thị "Tên tòa nhà" và liên kết với input qua `for`/`id`

#### Scenario: UiInput hiển thị error message
- **WHEN** UiInput có prop `error="Tên tòa nhà là bắt buộc"`
- **THEN** error message hiển thị bên dưới input với màu đỏ, input có border đỏ

#### Scenario: UiInput emit update:modelValue khi người dùng gõ
- **WHEN** người dùng gõ vào UiInput
- **THEN** `update:modelValue` được emit với giá trị mới

---

### Requirement: UiModal hỗ trợ open/close và title
`UiModal` SHALL nhận `open` (boolean), `title` (string). SHALL emit `close` khi người dùng click backdrop hoặc nút close. SHALL dùng `<Teleport to="body">` để render ngoài DOM hierarchy.

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

---

### Requirement: UiStatusBadge hiển thị status với màu sắc tương ứng
`UiStatusBadge` SHALL nhận `status` string và hiển thị với màu sắc khác nhau theo từng trạng thái. SHALL có label tiếng Việt cho từng status.

#### Scenario: UiStatusBadge hiển thị đúng màu theo status
- **WHEN** UiStatusBadge nhận `status="active"`
- **THEN** badge hiển thị màu xanh lá (green) với label tương ứng

#### Scenario: UiStatusBadge không crash với status không xác định
- **WHEN** UiStatusBadge nhận một status value không có trong map
- **THEN** badge hiển thị fallback style (gray) thay vì throw error

---

### Requirement: UiEmptyState hiển thị trạng thái rỗng
`UiEmptyState` SHALL nhận `title` (string), `description` (string, optional), và optional slot `action` cho CTA button. SHALL dùng cho trường hợp list rỗng hoặc không có data.

#### Scenario: UiEmptyState hiển thị title và description
- **WHEN** UiEmptyState được render với `title` và `description`
- **THEN** cả hai text đều hiển thị, centered, với visual icon placeholder

#### Scenario: UiEmptyState hiển thị action button khi được cung cấp
- **WHEN** UiEmptyState có content trong slot `action`
- **THEN** content đó hiển thị bên dưới description

---

### Requirement: UiSkeleton dùng cho loading placeholder
`UiSkeleton` SHALL nhận `class` để control kích thước. SHALL hiển thị animated shimmer effect. Dùng thay cho spinner khi cần placeholder cho content đang load.

#### Scenario: UiSkeleton hiển thị shimmer animation
- **WHEN** UiSkeleton được render
- **THEN** element hiển thị animated shimmer (pulse hoặc wave effect)

#### Scenario: UiSkeleton nhận class để control kích thước
- **WHEN** UiSkeleton được render với `class="w-full h-4"`
- **THEN** skeleton có đúng kích thước đó
