## Why

Building hiện tại lưu phí dịch vụ dưới dạng JSON blob (`default_service_fees`). Cách này không query được, không có lịch sử thay đổi giá, và mỗi building mới phải nhập lại từ đầu. Khi hệ thống bắt đầu tính bill (v0.3), cần một data model chuẩn để billing engine biết:

- Phí nào áp dụng cho contract nào
- Giá bao nhiêu (per contract, có thể override từ building default)
- Cách tính (cố định / theo người / theo xe / theo kWh / theo m³)

## What Changes

- Tạo `service_catalog` — danh mục phí toàn hệ thống, seeded sẵn 8 loại phổ biến
- Tạo `building_services` — mỗi building bật/tắt dịch vụ nào + nhập giá riêng
- Tạo `contract_services` — khi tạo HĐ: auto-clone từ building defaults, admin review + nhập quantity trong wizard
- Xoá `default_service_fees` JSONB column khỏi buildings sau khi migrate data

## Non-goals

- Không tính bill trong change này — chỉ chuẩn bị master data
- Không có `room_services` — pricing override chỉ ở contract level
- Không có lịch sử thay đổi giá (price history) — scope v0.4
- Pricing type `per_kwh` và `per_m3` tạo schema sẵn nhưng billing logic thuộc v0.3

## Capabilities

### New Capabilities
- `service-catalog-api`: CRUD service_catalog (admin only); seeded data migration
- `building-services-api`: CRUD building_services per building
- `contract-services-api`: CRUD contract_services; auto-clone endpoint

### Modified Capabilities
- `buildings-database`: Drop `default_service_fees` JSONB column sau migration
- `buildings-client`: Building detail/settings thêm tab "Dịch vụ" để quản lý building_services
- `contracts-client`: Contract create wizard thêm tab "Dịch vụ" (auto-clone + review quantity)
- `contracts-api`: Contract create endpoint trigger auto-clone building_services → contract_services

## Data Model

```
service_catalog
  id, code, name, pricing_type, unit, description, is_active, sort_order

building_services
  id, building_id, catalog_id, default_amount, is_active, sort_order

contract_services
  id, contract_id, catalog_id, amount (snapshot), quantity, is_enabled, notes
```

## Seeded Catalog

| code | name | pricing_type | unit |
|------|------|-------------|------|
| internet | Internet | fixed_per_room | — |
| garbage | Rác | per_person | người |
| parking_motorbike | Gửi xe máy | per_vehicle | xe |
| parking_bicycle | Gửi xe đạp | per_vehicle | xe |
| cleaning | Vệ sinh | fixed_per_room | — |
| elevator | Thang máy | per_person | người |
| surcharge | Phụ thu | fixed_per_room | — |
| other | Khác | fixed_per_room | — |

## Impact

- **DB**: 3 migrations mới (catalog + building_services + contract_services); 1 migration drop JSONB column
- **Server**: 3 entity repositories + services + API endpoints
- **Client**: Building settings page thêm tab; Contract create wizard thêm step
- **Data migration**: Script chuyển `default_service_fees` JSONB → `building_services` rows
