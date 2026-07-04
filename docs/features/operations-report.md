# Bao Cao Van Hanh

Tai lieu nay ghi lai huong explore cho module **Bao cao van hanh**. Muc tieu la tong hop hieu qua van hanh theo tung toa nha va tung thang, dua tren doanh thu da co tu billing va chi phi van hanh moi can nhap them.

## Muc Tieu

Bao cao van hanh tra loi cac cau hoi:

- Toa nha nay thang nay phai thu bao nhieu?
- Da thu tien mat bao nhieu?
- Con cong no bao nhieu?
- Tong chi phi van hanh bao nhieu?
- Lai/lo theo doanh thu va theo tien da thu la bao nhieu?
- Dien, nuoc thu khach so voi dien, nuoc dau vao chenh lech ra sao?

Module nay khong thay the billing workspace. Billing van la nguon tinh tien khach, phat hanh hoa don va ghi nhan thanh toan. Bao cao van hanh chi doc doanh thu tu billing va them lop chi phi cua toa nha.

## Nguyen Tac Du Lieu

Revenue khong nhap tay. Revenue lay tu billing:

```text
billing_periods(building_id, period_year, period_month)
  -> invoices(total_amount, paid_amount, balance_amount)
    -> invoice_charges(charge_type, amount)
```

Expense la du lieu moi, nhap theo building va theo thang.

```text
Revenue: billing sinh ra
Expense: nguoi dung nhap
Report: tong hop revenue + expense
```

## Khai Niem

| Khai niem | Y nghia |
| --- | --- |
| Doanh thu phat hanh | Tong tien tren hoa don da phat hanh, chua tru cong no. |
| Tien da thu | Tong payment thuc thu tu `invoice_payments`. |
| Cong no | Tong `balance_amount` cua invoice chua void. |
| Chi phi co dinh | Khoan lap lai theo thang cua building, vi du tien thue lai toa nha. |
| Chi phi thang | Khoan chi phat sinh theo building/thang, vi du dien dau vao, nuoc dau vao, sua chua. |
| Lai theo doanh thu | Doanh thu phat hanh - tong chi. |
| Lai tien mat | Tien da thu - tong chi. |

## Chi Phi Co Dinh

Tien thue lai toa nha/can ho nen la chi phi co dinh co lich su hieu luc, khong nen chi luu mot field tren `buildings`. Ly do: khi gia thue thay doi, bao cao thang cu van phai dung.

De xuat bang:

```text
building_fixed_costs
- id
- building_id
- category
- amount
- effective_from_period_year
- effective_from_period_month
- effective_to_period_year
- effective_to_period_month
- note
- created_by
- created_at
- updated_at
```

MVP category co dinh:

```text
rent
```

Sau nay co the mo rong fixed cost cho internet hop dong dai han, phi quan ly co dinh, luong nhan su co dinh.

## Chi Phi Theo Thang

Chi phi phat sinh theo thang nen luu thanh tung dong expense.

De xuat bang:

```text
building_expenses
- id
- building_id
- expense_date
- period_year
- period_month
- category
- amount
- payee
- payment_method
- note
- created_by
- created_at
- updated_at
- voided_at
- voided_by
- void_reason
```

Category MVP:

```text
electricity_input   tien dien dau vao
water_input         tien nuoc dau vao
internet            internet / truyen hinh
cleaning            ve sinh / rac / tap vu
repair              sua chua / bao tri
admin_fee           cong an / tam tru / giay to / hanh chinh
supplies            vat tu van hanh
staff               luong nhan su
rent_adjustment     dieu chinh tien thue nha, neu co
other               khac
```

## Cong Thuc Bao Cao

Bao cao theo `building_id + period_year + period_month`.

```text
Doanh thu phat hanh
= sum(invoices.total_amount)
  where invoice.status != 'void'

Tien da thu
= sum(invoice_payments.amount)
  where invoice_payments.deleted_at is null
  and invoice belongs to building/month

Cong no
= sum(invoices.balance_amount)
  where invoice.status != 'void'

Tong chi
= fixed_costs ap dung trong thang
+ sum(building_expenses.amount)
   where voided_at is null

Lai theo doanh thu
= Doanh thu phat hanh - Tong chi

Lai tien mat
= Tien da thu - Tong chi
```

Doanh thu theo nhom lay tu `invoice_charges.charge_type`:

```text
rent
electricity
water
service
discount
surcharge
adjustment
other
```

Voi hien thi tong quan, discount nen hien la so am hoac dong rieng de nguoi dung thay ro.

## Dien Nuoc Dau Vao Va Dau Ra

Dien/nuoc la diem quan trong cua can ho dich vu. Bao cao can hien rieng chenh lech dau vao/dau ra:

```text
Dien thu khach
= sum(invoice_charges.amount where charge_type = 'electricity')

Dien dau vao
= sum(building_expenses.amount where category = 'electricity_input')

Chenh dien
= Dien thu khach - Dien dau vao

Nuoc thu khach
= sum(invoice_charges.amount where charge_type = 'water')

Nuoc dau vao
= sum(building_expenses.amount where category = 'water_input')

Chenh nuoc
= Nuoc thu khach - Nuoc dau vao
```

Vi du:

```text
Dien thu khach:  8,000,000
Dien dau vao:    6,700,000
Chenh dien:     +1,300,000

Nuoc thu khach:  2,300,000
Nuoc dau vao:    1,800,000
Chenh nuoc:       +500,000
```

## UI De Xuat

Menu/page chinh:

```text
Bao cao van hanh
```

Mo ta:

```text
Theo doi doanh thu, chi phi va lai/lo tung toa nha theo thang.
```

Route co the la:

```text
/operations-report
```

Hoac neu dat trong detail building:

```text
/buildings/[id]/operations
```

MVP nen co page tong hop rieng `/operations-report`, vi admin can so sanh nhieu toa.

### Bo Loc

- Building
- Thang/nam
- Category chi phi

Manager chi thay building duoc gan. Admin thay tat ca.

### Tong Quan

Metric cards:

- Doanh thu phat hanh
- Tien da thu
- Cong no
- Tong chi
- Lai theo doanh thu
- Lai tien mat

### Breakdown Thu

Bang/cot:

- Tien phong
- Dien thu khach
- Nuoc thu khach
- Dich vu
- Phu thu/khac
- Giam gia

### Breakdown Chi

Bang/cot:

- Tien thue nha co dinh
- Dien dau vao
- Nuoc dau vao
- Internet
- Ve sinh/rac
- Sua chua
- Cong an/hanh chinh
- Vat tu
- Khac

### So Chi Phi

Bang expense entries:

- Ngay chi
- Toa nha
- Loai chi
- So tien
- Tra cho ai
- Phuong thuc
- Ghi chu
- Nguoi nhap
- Hanh dong: sua / huy

Nut chinh:

```text
Them khoan chi
```

## API De Xuat

```text
GET    /api/operations-report
GET    /api/building-expenses
POST   /api/building-expenses
PATCH  /api/building-expenses/[id]
DELETE /api/building-expenses/[id]

GET    /api/building-fixed-costs
POST   /api/building-fixed-costs
PATCH  /api/building-fixed-costs/[id]
```

Delete nen la soft void, khong hard delete:

```text
DELETE /api/building-expenses/[id]
-> set voided_at, voided_by, void_reason
```

## Quyen Va Scope

Capabilities de xuat:

```text
operations-report.read
building-expenses.read
building-expenses.write
building-expenses.delete
building-fixed-costs.read
building-fixed-costs.write
```

Admin:

- Xem tat ca building.
- Cau hinh chi phi co dinh.
- Them/sua/huy chi phi.
- Xem lai/lo tong hop.

Manager:

- Chi xem building duoc gan.
- Co the them chi phi cho building duoc gan neu duoc cap quyen.
- Khong duoc cau hinh chi phi co dinh neu khong co permission rieng.

Can dung `getAssignedBuildingIds` va `assertBuildingScope` giong cac module hien co.

## Audit

Expense va fixed cost nen ghi audit master/operations, vi day la du lieu tai chinh.

Action codes de xuat:

```text
building_expense.created
building_expense.updated
building_expense.voided
building_fixed_cost.created
building_fixed_cost.updated
building_fixed_cost.ended
```

Neu muon tach rieng, co the tao `operations_audit_events`. MVP co the reuse audit chung neu phu hop voi model hien tai.

## MVP Scope

Phase 1 nen lam:

1. Bang `building_expenses`.
2. Bang `building_fixed_costs` voi category `rent`.
3. API CRUD cho fixed costs va expenses.
4. API `operations-report` tong hop theo building/month.
5. Page `Bao cao van hanh` voi filters, metric cards, revenue breakdown, expense breakdown, expense table.
6. Manager scope theo building assignment.

Chua nen lam trong MVP:

- Approval workflow.
- Upload hoa don/chung tu.
- Custom categories.
- Multi-currency.
- Ke toan double-entry.
- Tax/VAT.

## Open Questions (Da Chot)

- Manager co duoc nhap chi phi khong? => Co. Manager co `building-expenses.write` cho building duoc gan, nhung khong duoc huy (`building-expenses.delete`) va khong cau hinh fixed cost.
- Khoan chi co bat buoc ly do khi huy khong? => Co. Void la soft-void, bat buoc `void_reason`.
- Fixed cost co nhieu dong theo lich su hieu luc tu MVP khong? => Co. `building_fixed_costs` co `effective_from`/`effective_to` theo period, ket thuc bang cach set `effective_to` qua PATCH.
- Report uu tien page nao? => `/operations-report` tong hop theo building + thang (MVP mot toa mot thang).

## Trang Thai Trien Khai (MVP)

Da ship trong change `add-operations-report`:

- Bang `building_expenses`, `building_fixed_costs` + RLS (admin/owner FOR ALL; manager SELECT/INSERT/UPDATE expense, SELECT fixed cost).
- Capabilities: `operations-report.read`, `building-expenses.read/write/delete`, `building-fixed-costs.read/write`. Admin + owner co du 6; manager chi co `operations-report.read`, `building-expenses.read`, `building-expenses.write`.
- API: `GET /api/operations-report`, `GET|POST /api/building-expenses`, `PATCH|DELETE /api/building-expenses/[id]` (DELETE = soft-void, doc `void_reason` tu body), `GET|POST /api/building-fixed-costs`, `PATCH /api/building-fixed-costs/[id]` (end-date qua `effective_to`).
- Flow: page `/operations-report` -> composable `useOperationsReport`/`useOperationsMutations` -> server API -> service -> repository -> Supabase.
- Service enforce `can(...)`, `assertBuildingScope(..., 'read'|'write')`, fixed-cost overlap => 409 CONFLICT, audit tren moi mutation.
- Revenue read-only tu invoice khong void + payment `deleted_at is null`. Chi phi da void bi loai khoi tong va khoi danh sach report.
- Audit actions: `building_expense.created/updated/voided`, `building_fixed_cost.created/updated/ended`.

Chua lam (nhu MVP scope da neu): approval, upload chung tu, custom category, multi-currency, double-entry, tax/VAT, so sanh nhieu toa cung luc.
