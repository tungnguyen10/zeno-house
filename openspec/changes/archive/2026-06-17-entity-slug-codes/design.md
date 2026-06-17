## Context

Hiện tại building đã có `slug` trong DB (migration `20260614000000_add_building_slugs.sql`). Các entity còn lại (room, tenant, contract) dùng UUID thô trong URL. Mục tiêu là thêm một **code** có ý nghĩa cho mỗi entity để thay thế UUID trong URL, đồng thời giữ UUID là primary key nội bộ.

Có hai lớp thay đổi tách biệt hoàn toàn:
1. **Data layer** — DB schema + server logic: tạo/persist/lookup codes
2. **UI layer** — routes + composables + route helpers: consume codes từ API

Lớp data không phụ thuộc lớp UI. Có thể ship và test độc lập.

## Goals / Non-Goals

**Goals:**
- Mỗi entity có một column `code` (hoặc `slug`) dùng làm URL identifier, unique globally, stable sau khi tạo
- URL đọc được và phản ánh cấu trúc nghiệp vụ
- UUID-based URL cũ vẫn resolve (redirect hoặc fallback) — không break bookmark/link hiện tại
- Code generation logic tập trung tại `app/utils/format/codes.ts`, dùng chung client + server

**Non-Goals:**
- Không thêm SEO optimization hay canonical URL logic
- Không đổi primary key — UUID vẫn là `id` nội bộ, foreign key, API payload
- Không internationalize codes (luôn ASCII)
- Không implement tenant portal (phase sau)
- Không rename building slug hiện tại

## Decisions

### D1 — Code storage: computed vs. persisted

**Quyết định: Persisted trong DB.**

Computed-on-the-fly (từ tên hoặc slug) không đảm bảo stability khi tên entity thay đổi. Persisted code cho phép unique index tại DB, lookup O(1), và immutability enforcement tại storage layer.

Alternatives: Compute từ slug mỗi lần — loại bỏ vì tên building đổi sẽ break URL.

---

### D2 — Building code algorithm

**Quyết định: First char của mỗi word trong `slug`, auto-suffix khi conflict.**

```
"zeno-house-phu-nhuan" → split('-') → ["z","h","p","n"] → "zhpn"
Conflict "zeno-house-phuong-nam" → "zhpn" exists → "zhpn2"
```

Code lock rule: immutable sau khi building có phòng đầu tiên (vì room.code = `{buildingCode}-{roomSlug}`). Admin có thể edit code trước đó qua building settings.

---

### D3 — Room identity: two columns

**Quyết định: `rooms.slug` (scoped per building) + `rooms.code` (global unique).**

```
rooms.slug = slugify(room_number)   → "b201"
rooms.code = building.code + '-' + rooms.slug → "zhpn-b201"

UNIQUE(building_id, slug)
UNIQUE(code)
```

`slug` cần thiết cho route `/buildings/:buildingSlug/rooms/:roomSlug` (navigation từ building detail). `code` là canonical identifier cho route `/rooms/:code`.

Room slug là immutable sau khi tạo (đổi room_number → không tự đổi slug, cần explicit update).

---

### D4 — Tenant code format

**Quyết định: `{nameInitials}-{year}-{seq}` — independent của building.**

```
"Nguyễn Văn A" → slugify → "nguyen-van-a" → first char per word → "nva"
code = "nva-2026-0001"
```

- Set ngay khi tạo tenant (không cần có contract trước)
- Initials lấy từ `full_name` qua slugify để strip dấu
- Conflict (cùng initials): sequence tiếp tục tăng → "nva-2026-0002"
- Immutable sau khi tạo

Alternatives: Dùng building code prefix như "zhpn-kh-..." — loại bỏ vì tenant tạo độc lập, không có building context tại thời điểm tạo.

Lưu ý privacy: initials không lộ tên đầy đủ, chấp nhận được. Spec `operational-url-identifiers` yêu cầu không dùng name-derived slug — code dạng initials không vi phạm vì không reconstructable về tên đầy đủ.

---

### D5 — Contract code migration

**Quyết định: Hard cutover — migrate toàn bộ rows.**

Format cũ: `hd-2026-0001` → format mới: `hd-zhpn-2026-0001`

Migration SQL join `contracts → rooms → buildings` để lấy building code, update tất cả rows trong 1 transaction. Project đang giai đoạn sớm, data volume nhỏ.

Sau migration, UUID-based contract URL (`/contracts/uuid`) vẫn resolve qua `isUuid()` check trong `findByIdentifier`.

Alternatives: Dual-format support mãi mãi — loại bỏ vì làm phức tạp server logic lâu dài.

---

### D6 — Shared code generation module

**Quyết định: `app/utils/format/codes.ts` — single source of truth.**

Tất cả algorithms (building code, room code, tenant code initials) đặt tại đây. Server repositories import để generate, client route helpers import để build paths.

Existing `app/utils/format/slug.ts` giữ nguyên — `codes.ts` build on top của nó.

---

### D7 — Server identifier resolution

**Quyết định: `findByIdentifier(identifier)` pattern cho cả 4 entities.**

```ts
// Pattern đã có ở buildings + contracts, extend sang rooms + tenants
const column = isUuid(identifier) ? 'id' : 'code'
```

Điều này tự động handle UUID fallback (backward compat) mà không cần logic phân nhánh phức tạp.

---

### D8 — Route param naming

**Quyết định: Đổi thư mục page từ `[id]` → `[code]` cho rooms, tenants, contracts.**

```
app/pages/rooms/[id]/     →  app/pages/rooms/[code]/
app/pages/tenants/[id]/   →  app/pages/tenants/[code]/
app/pages/contracts/[id]/ →  app/pages/contracts/[code]/
```

Param name trong page logic đổi từ `route.params.id` sang `route.params.code`. Không có breaking change cho người dùng vì URL format cũng đổi.

## Risks / Trade-offs

**[Risk] Building code collision giữa 2 buildings tên tương tự**
→ Mitigation: Auto-suffix enforced tại DB (unique index) + application layer. Admin có thể override manually trong settings trước khi tạo phòng.

**[Risk] Tenant initials không unique — nhiều "nva" cùng năm**
→ Mitigation: Sequence tăng toàn cục theo initials+year prefix. "nva-2026-0001", "nva-2026-0002"... Không có conflict thực sự vì sequence đảm bảo uniqueness.

**[Risk] Contract code migration thất bại nửa chừng**
→ Mitigation: Toàn bộ migration trong 1 transaction. Rollback tự động nếu lỗi. Backup trước khi chạy.

**[Risk] Room slug conflict khi 2 phòng cùng tên trong 1 building**
→ Mitigation: `UNIQUE(building_id, slug)` enforce tại DB. Server trả lỗi rõ ràng khi tạo phòng trùng slug.

**[Risk] UUID bookmark cũ của user bị break**
→ Mitigation: `findByIdentifier` vẫn accept UUID. Tuy nhiên page param là `code` — cần server middleware hoặc page-level check để redirect `/rooms/uuid` → `/rooms/zhpn-b201`.

## Migration Plan

**Thứ tự deploy (data layer trước, UI sau):**

```
Step 1: DB migrations (có thể apply trước khi deploy code)
  1a. add_building_codes         — buildings.code col, backfill, unique index
  1b. add_room_slugs_codes       — rooms.slug + rooms.code, backfill, unique indexes
  1c. add_tenant_codes           — tenants.code col, backfill sequences
  1d. update_contract_codes      — update format hd-YYYY-NNNN → hd-{bcode}-YYYY-NNNN

Step 2: Server changes (deploy cùng hoặc sau DB)
  - Repository updates: generation logic, findByIdentifier
  - API responses: include code fields trong response

Step 3: Client changes (deploy sau server)
  - Route rename [id] → [code]
  - operational.ts helpers
  - Page param updates

Step 4: Smoke test
  - Verify UUID URL vẫn resolve
  - Verify new code URLs work
  - Verify contract code format mới đúng
```

**Rollback:**
- DB: migration files có thể reverse (drop columns). Data migration contract_code là one-way — cần backup trước.
- Server: backward compat với UUID qua `isUuid()` check tự nhiên là safety net.

## Open Questions

- **Building code edit UI**: Settings page hiện tại (`/buildings/[id]/settings`) có sẵn — chỉ cần thêm field. Confirm thêm vào đây thay vì tạo trang riêng?
- **Room slug khi đổi room_number**: Nếu admin đổi tên phòng, slug có tự update không? Đề xuất: không tự update (stable slug), chỉ update khi admin explicit confirm. Scope của change này: không implement, để sau.
