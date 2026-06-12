# Zeno House â€” Tráº¡ng thÃ¡i dá»± Ã¡n (31/05/2026)

Há»‡ thá»‘ng quáº£n lÃ½ báº¥t Ä‘á»™ng sáº£n cho chá»§ nhÃ  trá»/tÃ²a nhÃ .

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4 (`future.compatibilityVersion: 4`), Vue 3, TypeScript strict |
| Styling | TailwindCSS + `clsx` |
| State | Pinia (global) + composables (domain/server state) |
| Auth + DB | Supabase (`@nuxtjs/supabase`) |
| Validation | Zod v4 |
| Icons | SVG via `nuxt-svgo` (auto-import prefix `Icon`) |
| Font | Inter variable â€” self-hosted `/public/fonts/` |
| Email | Resend API |
| Bot protection | Cloudflare Turnstile |

---

## Database (20 migrations)

| File | Ná»™i dung |
|------|----------|
| `20260514000000` | `buildings` table |
| `20260514000001` | Fix buildings RLS |
| `20260514000002` | `rooms` table |
| `20260514000003` | Drop `buildings.total_rooms` column |
| `20260514000004` | `tenants` table |
| `20260514000005` | `room_assignments` table (deprecated) |
| `20260515000000` | `contracts` table |
| `20260517000000` | Building operational config (area, floors, type) |
| `20260517000001` | Contract commercial terms (price, deposit, payment day) |
| `20260517000002` | Occupants + meter_devices (meter_devices sau bá»‹ drop) |
| `20260517000003` | `contract_payments` table |
| `20260517000004` | Contract renewal columns |
| `20260517000005` | `contract_renewals` table |
| `20260517000006` | Occupant uniqueness constraint |
| `20260530000000` | DROP `room_assignments` (thay báº±ng contracts) |
| `20260530100000` | Tenant enrichment: +gender, occupation, id_issued_*, emergency_contact_* |
| `20260530200000â€“05` | `service_catalog` (8 items), `building_services`, `contract_services`, seed, migrate, drop old JSONB column |
| `20260530300000` | `meter_readings` table |
| `20260530400000` | Simplify meter model: DROP `meter_devices`, Ä‘á»•i UNIQUE key sang `(room_id, meter_type, period_year, period_month, reading_type)` |

---

## Domain Entities

### Buildings
- CRUD: list (`/buildings`), create, edit, detail
- Detail page: thÃ´ng tin tÃ²a nhÃ , danh sÃ¡ch phÃ²ng, link tá»›i settings & meter-readings
- **Settings** (`/buildings/[id]/settings`): cáº¥u hÃ¬nh 8 dá»‹ch vá»¥ máº·c Ä‘á»‹nh (toggle + amount + pricing_type), báº£ng matrix cross-tab cho active contracts, nÃºt Ä‘á»“ng bá»™ dá»‹ch vá»¥ vÃ o há»£p Ä‘á»“ng
- **Meter Readings** (`/buildings/[id]/meter-readings`): chá»n ká»³ (thÃ¡ng/nÄƒm), nháº­p hÃ ng loáº¡t Ä‘iá»‡n/nÆ°á»›c cho tá»«ng phÃ²ng, hiá»‡n consumption so vá»›i ká»³ trÆ°á»›c, bulk upsert

### Rooms
- CRUD: list, create, edit, detail
- Status: `available` / `occupied` / `maintenance`
- Detail page: thÃ´ng tin phÃ²ng, há»£p Ä‘á»“ng Ä‘ang active (tenant, link), lá»‹ch sá»­ há»£p Ä‘á»“ng (khÃ´ng hiá»ƒn thá»‹ nháº­p chá»‰ sá»‘ Ä‘á»“ng há»“ â€” monthly readings thuá»™c khÃ´ng gian Váº­n hÃ nh thÃ¡ng)
- NÃºt "Giao phÃ²ng" (admin, khi available) â†’ navigate `/contracts/create?room_id=...`
- NÃºt "Thu phÃ²ng" (admin, khi cÃ³ active contract) â†’ terminate contract â†’ room vá» `available`
- **Side-effects tá»± Ä‘á»™ng**: táº¡o contract â†’ room `occupied`; terminate/expire â†’ room `available` (bá» qua náº¿u Ä‘ang `maintenance`)

### Tenants
- CRUD: list, create, edit, detail
- **Enriched profile**: gender, nghá» nghiá»‡p, ngÃ y cáº¥p / nÆ¡i cáº¥p CCCD, liÃªn há»‡ kháº©n cáº¥p (tÃªn + phone)
- Detail page: thÃ´ng tin cÃ¡ nhÃ¢n Ä‘áº§y Ä‘á»§, há»£p Ä‘á»“ng active, lá»‹ch sá»­ há»£p Ä‘á»“ng

### Contracts *(entity trung tÃ¢m)*
- CRUD: list, create wizard, edit, detail
- **Commercial terms**: giÃ¡ thuÃª, tiá»n cá»c, ngÃ y thanh toÃ¡n, chu ká»³ há»£p Ä‘á»“ng
- **Occupants/Roommates**: thÃªm ngÆ°á»i á»Ÿ cÃ¹ng, ghi nháº­n ngÃ y dá»n ra, xÃ³a
- **Payments**: add/edit/delete (deposit, prepaid_rent, rent, other), hiá»‡n tá»•ng tiá»n Ä‘Ã£ thanh toÃ¡n
- **Renewals**: gia háº¡n táº¡i chá»— (extend) hoáº·c táº¡o há»£p Ä‘á»“ng má»›i (new_contract) â†’ auto navigate sang contract má»›i
- **Contract Services**: káº¿ thá»«a tá»« building services khi táº¡o (clone), chá»‰nh sá»­a per-contract (amount, quantity, is_enabled, notes)
- **Handover Readings**: 2 rows cá»‘ Ä‘á»‹nh (Ä‘iá»‡n / nÆ°á»›c) cho handover_in (khi táº¡o) vÃ  handover_out (chá»‰ khi terminated/expired)
- Status: `active` / `expired` / `terminated`

### Meter Readings
- Model Ä‘Æ¡n giáº£n: `(room_id, meter_type, period_year, period_month, reading_type)`
- `reading_type`: `monthly` | `handover_in` | `handover_out`
- API: `GET/POST /api/meter-readings`, `GET/POST /api/meter-readings/bulk`, `PATCH /api/meter-readings/[id]`

### Service Catalog & Services
- **8 catalog items** cá»‘ Ä‘á»‹nh: Ä‘iá»‡n, nÆ°á»›c, internet, rÃ¡c, xe mÃ¡y/Ã´ tÃ´, vá»‡ sinh, thang mÃ¡y, báº£o vá»‡
- **building_services**: override giÃ¡/tráº¡ng thÃ¡i/pricing_type per building
- **contract_services**: clone tá»« building khi táº¡o contract, chá»‰nh sá»­a per contract (amount, quantity, is_enabled, notes)
- `pricing_type`: `fixed` | `per_person` | `per_unit`
- Äá»“ng bá»™: nÃºt sync thÃªm dá»‹ch vá»¥ cÃ²n thiáº¿u vÃ o há»£p Ä‘á»“ng active cá»§a building

### Dashboard
- Summary cards: sá»‘ tÃ²a nhÃ , phÃ²ng available/occupied/maintenance, há»£p Ä‘á»“ng active, tá»•ng tenant

---

## Server Layer (API â†’ Service â†’ Repository)

**12 domain groups** trong `server/`:

| Group | Endpoints chÃ­nh |
|-------|-----------------|
| `buildings` | GET list, POST, GET detail, PATCH, DELETE |
| `rooms` | GET list, POST, GET detail, PATCH, DELETE |
| `tenants` | GET list, POST, GET detail, PATCH, DELETE |
| `contracts` | GET list, POST, GET detail, PATCH, DELETE |
| `service-catalog` | GET list |
| `building-services` | GET list, POST upsert, PATCH |
| `contract-services` | GET list, PATCH |
| `meter-readings` | GET, POST, PATCH, GET bulk, POST bulk |
| `dashboard` | GET summary |
| `contract-occupants` | GET, POST, PATCH (move-out), DELETE |
| `contract-payments` | GET, POST, PATCH, DELETE |
| `contract-renewals` | GET, POST |

Má»—i group: **repository** (Supabase query only) â†’ **service** (business logic + permission check) â†’ **API handler** (Zod validate + auth guard + response envelope)

**Response envelope:**
```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError   = { error: { code: string; message: string; details?: unknown } }
```

---

## Client Layer

### Composables (23 files)

| Domain | Files |
|--------|-------|
| buildings | `useBuildingList`, `useBuildingDetail`, `useBuildingForm`, `useBuildingServices`, `useBuildingMeterReadings`, `useBuildingContractServices` |
| rooms | `useRoomList`, `useRoomDetail`, `useRoomForm` |
| tenants | `useTenantList`, `useTenantDetail`, `useTenantForm` |
| contracts | `useContractList`, `useContractDetail`, `useContractForm`, `useContractOccupants`, `useContractPayments`, `useContractRenewals`, `useContractServices`, `useContractHandoverReadings` |
| misc | `useDashboardSummary` |

### Components

**UI Primitives** (`app/components/ui/`):
- `UiButton`, `UiInput`, `UiModal`, `UiConfirmModal`, `UiSkeleton`, `UiStatusBadge`, `UiEmptyState`

**App Shell** (`app/components/app/`):
- `AppSidebar`, `AppHeader`, `AppStatCard`

**Domain Components:**
| Domain | Components |
|--------|------------|
| buildings | `BuildingCard`, `BuildingForm`, `BuildingServiceSettings`, `BuildingServicesMatrix`, `MeterReadingBulkInput` |
| rooms | `RoomCard`, `RoomForm` |
| tenants | `TenantForm` |
| contracts | `ContractForm`, `ContractOccupantForm`, `ContractPaymentForm`, `ContractRenewalForm`, `ContractServicesTab`, `ContractHandoverReadings` |

### Pages

| Route | Page |
|-------|------|
| `/` | Dashboard (summary cards) |
| `/login` | Auth page |
| `/buildings` | List |
| `/buildings/create` | Create form |
| `/buildings/[id]` | Detail (rooms, links to settings/meter-readings) |
| `/buildings/[id]/edit` | Edit form |
| `/buildings/[id]/settings` | Service settings + matrix |
| `/buildings/[id]/meter-readings` | Bulk meter reading input |
| `/rooms` | List |
| `/rooms/create` | Create form |
| `/rooms/[id]` | Detail (active contract, history) |
| `/rooms/[id]/edit` | Edit form |
| `/tenants` | List |
| `/tenants/create` | Create form |
| `/tenants/[id]` | Detail (full profile, contracts) |
| `/tenants/[id]/edit` | Edit form |
| `/contracts` | List |
| `/contracts/create` | Create wizard (pre-fill tá»« `?room_id=`) |
| `/contracts/[id]` | Detail (táº¥t cáº£ sections) |
| `/contracts/[id]/edit` | Edit form |

### Validators (Zod schemas, dÃ¹ng chung client + server)
`buildings`, `rooms`, `tenants`, `contracts`, `contract-occupants`, `contract-payments`, `contract-renewals`, `contract-services`, `building-services`, `meter-readings`

### Mappers (DB row â†’ DTO)
`buildings`, `rooms`, `tenants`, `contracts`, `contract-occupants`, `contract-payments`, `contract-renewals`, `contract-services`, `building-services`, `service-catalog`, `meter-readings`

---

## Auth & Permissions

- Supabase Auth (email/password)
- Roles: `admin` (full access), `manager` (building Ä‘Æ°á»£c phÃ¢n cÃ´ng)
- Route guard: `auth.global.ts` middleware
- Capabilities check trong `server/utils/permissions.ts`
- `useAuthStore` (Pinia): session, user, role, `isAdmin`

---

## Data Flow

```
page
 â””â”€â–¶ composable ($fetch / useFetch)
       â””â”€â–¶ server/api/   (Zod validate, auth guard)
             â””â”€â–¶ server/services/   (business logic, permission check)
                   â””â”€â–¶ server/repositories/   (Supabase query)
```

Client **khÃ´ng** gá»i Supabase trá»±c tiáº¿p cho business data.

---

## Nhá»¯ng gÃ¬ chÆ°a cÃ³ (out of scope v0.1â€“v0.2.5)

- Invoice / billing module
- Tenant portal (role `tenant`)
- Notification / email flow (Resend API Ä‘Ã£ setup, chÆ°a dÃ¹ng)
- Google Analytics (key Ä‘Ã£ cÃ³ trong env, chÆ°a integrate UI)
- CI pipeline (spec cÃ³, chÆ°a implement)

---

## v0.2.5 cleanup update (12/06/2026)

- Billing workspace readability polish landed: invoice/payment/audit DTOs now carry display fields so primary UI columns can show tenant, room, actor, entity label, and Vietnamese audit summaries instead of raw UUIDs.
- Billing workspace IA is reduced to three primary tabs with a sticky KPI strip, audit in `UiDrawer`, and close-period in a header overflow action.
- Design system now includes `UiDrawer`, `UiToastHost`, and `useToast` patterns for billing mutation feedback.

---

## Billing workspace â€” tráº¡ng thÃ¡i & roadmap (12/06/2026)

### 3 OpenSpec change Ä‘ang má»Ÿ

| Change | Má»¥c tiÃªu | Tráº¡ng thÃ¡i |
|--------|----------|-----------|
| `billing-readability-and-polish` | Bỏ UID khỏi cột chính, gom IA 3 tab, drawer audit, header overflow Chốt kỳ, toast, **callout chênh lệch draft↔issued** | ✅ section 1–14 đã code; ✅ all_done 49/49 |
| `billing-power-features` | Bulk paste chá»‰ sá»‘, bulk thanh toÃ¡n, **há»§y phÃ¡t hÃ nh cáº£ ká»³** (`billing.unissue`), export Excel | â³ chÆ°a báº¯t Ä‘áº§u |
| `billing-test-baseline` | Vitest + fixtures + unit/integration cho service & composable billing | baseline test framework seeded |

Má»i change Ä‘á»u `npx openspec validate <id> --strict` pass. Spec sá»‘ng á»Ÿ `openspec/changes/<id>/`.

### Bug Ä‘Ã£ sá»­a khi smoke-test

- **Void khÃ´ng tÃ­nh láº¡i draft**: `app/pages/billing/[building]/[period].vue` `@reload` thiáº¿u `loadDrafts()` + `loadGrid()`. Fix báº±ng named function `reloadAfterInvoiceChange()` gá»i Ä‘á»§ 4 loader.
- **Tab name lá»‡ch**: `BillingIssueStep.vue` cÃ²n ghi "SoÃ¡t hoÃ¡ Ä‘Æ¡n" sau khi merge tab â†’ Ä‘á»•i thÃ nh "Chá»‰ sá»‘ & hoÃ¡ Ä‘Æ¡n nhÃ¡p".

### NguyÃªn táº¯c báº¥t di báº¥t dá»‹ch

1. **Invoice `issued` lÃ  immutable.** KhÃ´ng cÃ³ endpoint nÃ o sá»­a sá»‘ tiá»n cá»§a invoice Ä‘Ã£ phÃ¡t hÃ nh.
2. **Má»i thay Ä‘á»•i Ä‘i qua Ä‘Ãºng 3 lá»‘i**:
   - `void + reissue` â€” chá»‰ khi invoice **chÆ°a cÃ³ payment** vÃ  ká»³ chÆ°a close.
   - `adjustment` â€” khi invoice **Ä‘Ã£ cÃ³ payment**, táº¡o dÃ²ng Ä‘iá»u chá»‰nh (delta Ã¢m = hoÃ n, dÆ°Æ¡ng = thu thÃªm).
   - `unissue` (cáº£ ká»³) â€” admin only, dÃ¹ng khi cáº¥u hÃ¬nh lá»‡ch hÃ ng loáº¡t; sáº½ void invoice chÆ°a thu, giá»¯ invoice Ä‘Ã£ thu.
3. **Má»i destructive action** (void / unissue / close) báº¯t buá»™c nháº­p **lÃ½ do â‰¥10 kÃ½ tá»±**, lÆ°u vÃ o audit metadata, format ra summary tiáº¿ng Viá»‡t qua `formatAuditSummary`.
4. **UI dáº«n Ä‘Æ°á»ng, khÃ´ng tá»± Ä‘á»™ng.** Override chá»‰ sá»‘ sau phÃ¡t hÃ nh KHÃ”NG tá»± update invoice â€” UI hiá»‡n callout Ä‘á» xuáº¥t, manager pháº£i báº¥m CTA.
5. **KhÃ´ng lá»™ UID** á»Ÿ cá»™t chÃ­nh báº¥t ká»³ báº£ng nÃ o. UID chá»‰ trong drawer "Chi tiáº¿t ká»¹ thuáº­t" hoáº·c tooltip.

### Flow tá»•ng (sau khi 3 change land)

```mermaid
flowchart TD
    Start([Manager má»Ÿ ká»³ váº­n hÃ nh]) --> KPI[Sticky KPI strip]
    KPI --> Tab1[Tab: Chá»‰ sá»‘ & hoÃ¡ Ä‘Æ¡n nhÃ¡p]

    Tab1 --> EnterReading[Nháº­p chá»‰ sá»‘ Ä‘iá»‡n/nÆ°á»›c]
    EnterReading --> AutoSave[Auto-save debounce 800ms]
    AutoSave --> ComputeDraft[Server tÃ­nh láº¡i draft]

    ComputeDraft --> CheckIssued{ÄÃ£ cÃ³ invoice<br/>cho HÄ nÃ y?}
    CheckIssued -- ChÆ°a --> Issuable[Draft sáºµn sÃ ng phÃ¡t hÃ nh]
    Issuable --> Tab2[Tab: PhÃ¡t hÃ nh]
    Tab2 --> IssueAll[PhÃ¡t hÃ nh toÃ n ká»³]
    IssueAll --> Issued([Invoice = issued])

    CheckIssued -- CÃ³ rá»“i --> CompareTotal{Draft vs Issued<br/>chÃªnh â‰¥ 1.000Ä‘?}
    CompareTotal -- KhÃ´ng --> Skip[Bá» qua, Ä‘Ã£ Ä‘á»“ng bá»™]
    CompareTotal -- CÃ³ --> Callout[âš ï¸ Discrepancy Callout]

    Callout --> CheckPayment{Invoice Ä‘Ã£ cÃ³<br/>payment?}
    CheckPayment -- ChÆ°a thu --> Choice1[CTA: Adjustment / Void+Reissue]
    Choice1 -- Adjustment --> AdjModal[Adjustment modal<br/>pre-fill amount = -delta]
    Choice1 -- Void+Reissue --> VoidModal[Void modal + lÃ½ do]
    VoidModal --> VoidDone[Invoice = void] --> Tab1
    CheckPayment -- ÄÃ£ thu --> Choice2[CTA Adjustment only<br/>Void disabled]
    Choice2 --> AdjModal
    AdjModal --> Issued

    Issued --> Tab3[Tab: Thanh toÃ¡n & cÃ´ng ná»£]
    Tab3 --> Pay[Ghi thu / bulk thu]
    Pay --> Paid{Äá»§?}
    Paid -- ChÆ°a --> Tab3
    Paid -- Äá»§ --> header overflow[header overflow â†’ Chá»‘t ká»³]
    header overflow --> Closed([Ká»³ = closed])

    Issued -.unissue cáº£ ká»³.-> header overflowAdmin[header overflow â†’ Há»§y phÃ¡t hÃ nh]
    header overflowAdmin --> UnissueModal[Modal: lÃ½ do + preview]
    UnissueModal --> Tab1

    Tab1 -.Nháº­t kÃ½.-> Drawer[UiDrawer pháº£i - audit]
    Tab2 -.Nháº­t kÃ½.-> Drawer
    Tab3 -.Nháº­t kÃ½.-> Drawer
```

### 4 case xá»­ lÃ½ lá»‡ch sá»‘

| Case | Khi nÃ o | Action |
|------|---------|--------|
| Happy path | Láº§n Ä‘áº§u phÃ¡t hÃ nh ká»³ | Nháº­p chá»‰ sá»‘ â†’ PhÃ¡t hÃ nh â†’ Thu â†’ Chá»‘t |
| Override sau phÃ¡t hÃ nh (chÆ°a thu) | PhÃ¡t hiá»‡n sai trÆ°á»›c khi khÃ¡ch tráº£ | Override â†’ Callout â†’ **Há»§y + PhÃ¡t hÃ nh láº¡i** |
| Override sau phÃ¡t hÃ nh (Ä‘Ã£ thu) | PhÃ¡t hiá»‡n sai sau khi Ä‘Ã£ thu | Override â†’ Callout â†’ **Táº¡o Ä‘iá»u chá»‰nh** |
| Sai cáº¥u hÃ¬nh cáº£ ká»³ | PhÃ¡t hÃ nh nháº§m hÃ ng loáº¡t (vd giÃ¡ Ä‘iá»‡n sai) | header overflow â†’ **Há»§y phÃ¡t hÃ nh ká»³** (admin) â†’ fix config â†’ phÃ¡t hÃ nh láº¡i |

### Section 14 â€” Discrepancy callout (chÆ°a lÃ m, 8 task)

TÃ³m táº¯t tá»« `openspec/changes/billing-readability-and-polish/tasks.md` group 14:

1. **Server**: extend draft response per contract vá»›i `existingInvoice: { id, totalAmount, paidAmount, status } | null` (source: `activeInvoiceByContract` Ä‘Ã£ cÃ³ trong `server/services/billing/drafts.ts`).
2. **Types**: thÃªm field vÃ o `BillingDraftInvoice` á»Ÿ `app/types/billing.ts`.
3. **Component má»›i**: `app/components/billing/BillingDraftDiscrepancyCallout.vue`
   - Render khi `existingInvoice` tá»“n táº¡i vÃ  `|delta| â‰¥ 1000`
   - 2 CTA vá»›i rule: paid â†’ disable Void; closed â†’ áº©n cáº£ 2
   - Emit `intent:adjustment` `{ invoiceId, amount: -delta, label }` vÃ  `intent:void-reissue` `{ invoiceId }`
4. **Mount** trong row expanded cá»§a `BillingDraftGridStep.vue`, gáº§n warnings.
5. **Bubble intent** lÃªn `[period].vue`: switch sang tab payments, focus invoice row, má»Ÿ modal pre-filled.
6. **`BillingPaymentsStep.vue`** nháº­n inbound intent (prop hoáº·c shared store) â†’ má»Ÿ modal Ä‘Ãºng.
7. **`useBillingInvoiceActions`** thÃªm shortcut `referenceInvoiceId` + `label` cho adjustment payload.
8. **Smoke test** end-to-end.

### Files chÃ­nh trong billing workspace

| File | Vai trÃ² |
|------|---------|
| `app/pages/billing/[building]/[period].vue` | Workspace 3 tab + sticky KPI + drawer + header overflow action |
| `app/components/billing/BillingKpiStrip.vue` | KPI strip sticky |
| `app/components/billing/BillingDraftGridStep.vue` | Tab 1 â€” nháº­p chá»‰ sá»‘ + draft grid |
| `app/components/billing/BillingIssueStep.vue` | Tab 2 â€” phÃ¡t hÃ nh |
| `app/components/billing/BillingPaymentsStep.vue` | Tab 3 â€” thu tiá»n + adjustment + void |
| `app/components/billing/BillingAuditStep.vue` | Body cá»§a audit drawer |
| `app/components/billing/BillingCloseStep.vue` | Body của modal Chốt kỳ (header overflow action) |
| `server/services/billing/drafts.ts` | TÃ­nh draft per contract, computed `activeInvoiceByContract` |
| `server/services/billing/invoices.ts` | Issue / void / reissue / adjustment |
| `server/services/billing/payments.ts` | Record payment, list payment |
| `server/services/billing/audit.ts` | List audit + enrich qua resolver |
| `server/services/billing/audit-summary.ts` | `formatAuditSummary(action, metadata)` ra tiáº¿ng Viá»‡t |
| `server/services/billing/display.ts` | `BillingDisplayResolver` batch lookup actors/invoices/contracts |
