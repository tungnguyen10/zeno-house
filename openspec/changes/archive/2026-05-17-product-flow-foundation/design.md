## Context

v0.2 đã khóa Core Data cơ bản, nhưng vẫn thiếu lớp nền để v0.3 Monthly Billing Workspace được xây trên một mô hình vận hành rõ ràng. Change này không triển khai billing runtime; nó chốt lại boundary giữa Core Data và workspace-scoped billing, đồng thời làm giàu Building và Contract để các change billing sau này không phải đoán lại dữ liệu nền.

## Goals / Non-Goals

**Goals:**
- Chốt architecture boundary: Room là master data, Billing là workspace-scoped.
- Làm rõ Building là operational container có defaults và schedule, không chỉ là địa chỉ.
- Làm rõ Contract là commercial truth cho billing, bao gồm occupant count và terms.
- Định nghĩa quick room setup như một workflow tạo dữ liệu, không phải một mô hình domain mới.
- Định nghĩa occupant / roommate và meter device lifecycle ở mức dữ liệu và hành vi, đủ để v0.3 có thể đi tiếp mà không rework.

**Non-Goals:**
- Utility reading entry, service fee CRUD, invoice generation, payment tracking.
- Tenant portal hoặc automation jobs.
- Thay đổi room-centric UI để trở thành billing workspace.

## Decisions

### 1. Giữ một change nền tảng, không tách thành nhiều change nhỏ ở giai đoạn này

**Decision**: Gom các quyết định nền tảng vào một change `product-flow-foundation`, với một spec mới và một delta spec architecture.

**Rationale**: Các thay đổi này cùng giải một vấn đề duy nhất: chốt product model trước khi billing workspace xuất hiện. Tách quá sớm sẽ làm mất ngữ cảnh và khiến roadmap bị phân mảnh.

**Alternative considered**: Tách thành building / contract / occupancy / navigation changes riêng. Rejected vì đây là một lớp nền logic chung, không phải nhiều feature độc lập.

### 2. Building config được xem là metadata vận hành, không phải billing runtime

**Decision**: Building sẽ chứa defaults và schedule, nhưng không chứa state của billing runs, invoices, hay payment tracking.

**Rationale**: Building cần đóng vai trò template vận hành cho nhiều tháng billing, nhưng không nên mang dữ liệu ngắn hạn theo kỳ.

**Alternative considered**: Đưa các fields này vào workspace riêng. Rejected vì chúng là cấu hình gốc của building và cần được dùng ngay khi tạo room / contract.

### 3. Occupant model phải lưu được lịch sử

**Decision**: Occupant / roommate data được mô hình hóa như dữ liệu có lịch sử move-in / move-out, không overwrite trạng thái cũ.

**Rationale**: Water per person, occupancy history, và billing snapshots đều cần biết ai đã ở vào thời điểm nào.

**Alternative considered**: Lưu occupants như JSON trên contract. Rejected vì khó query, khó audit, và khó snapshot cho billing sau này.

### 4. Contract là nguồn truth thương mại

**Decision**: Contract giữ rent, deposit, occupant count, và commercial terms; room defaults chỉ là fallback.

**Rationale**: Billing cần một nguồn giá trị ổn định theo kỳ, không phụ thuộc vào UI room detail hay dữ liệu fallback rải rác.

**Alternative considered**: Lấy monthly rent từ room. Rejected vì room chỉ nên giữ default / fallback, còn giá thực tế phải gắn với hợp đồng.

### 5. Meter devices là lifecycle metadata riêng

**Decision**: Meter replacement được mô hình như lifecycle riêng, giữ lịch sử meter cũ thay vì overwrite reading.

**Rationale**: Đây là nền cho utility readings sau này; nếu không tách lifecycle, đọc số và thay đồng hồ sẽ bị lẫn logic.

**Alternative considered**: Chỉ lưu reading trong room. Rejected vì mất lịch sử thay thế meter.

## Risks / Trade-offs

- Mở rộng schema sớm có thể tăng bề mặt migration → Giảm rủi ro bằng cách giữ billing runtime deferred và chỉ thêm những field thật sự cần cho core-data alignment.
- Quick room setup có thể tạo lỗi partial batch → Dùng preview + validation trước submit và tạo theo batch transactional.
- Occupant model có thể làm form contract phức tạp hơn → Bắt đầu với role đơn giản (primary / roommate) và active count tối thiểu.
- Navigation placeholder có thể bị hiểu nhầm là feature billing hoàn chỉnh → Gắn nhãn placeholder rõ ràng và không expose billing actions từ Room detail.

## Migration Plan

1. Update OpenSpec proposal/design/specs cho v0.2.5 foundation.
2. Update architecture doc first so the boundary is explicit before implementation starts.
3. Add building / contract schema fields, then client forms and batch workflows.
4. Add navigation placeholder only after the boundary decision is documented.
5. Keep utility readings, service fees, invoices, and payments in separate v0.3 changes.

## Open Questions

- Should quick room setup live inside building create only, or also be available as a separate building action later?
- Should occupant count be manually editable on contract, or derived from active occupants by default?
- Should meter devices start as design-only in this phase, or should the schema land now even if no UI is exposed?