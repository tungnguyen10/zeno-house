---
type: Change Implementation Plan
title: "contract-documents-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, contracts, documents, docx, v2]
---

# Contract Documents (V2 PR4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue versioned contract and appendix DOCX files from a fixed template, store them immutably in private Storage with metadata and snapshot, and manage issued → signed → voided/replacement lifecycle.

**Architecture:** Pure server modules — `vndToWords`, `buildContractDocumentData`, `collectMissing`, `renderDocx` (docxtemplater + pizzip with a dotted-path parser and throwing `nullGetter`). `ContractDocumentService` orchestrates reserve (RPC) → upload → finalize (RPC), with compensation and a cron-triggered cleanup worker. Templates live in `server/assets/contract-templates/**` with a manifest.

**Tech Stack:** Nuxt 3 / Nitro, docxtemplater, pizzip, Supabase Storage + RPC, PL/pgSQL, pg_cron, Vitest.

**Spec:** [design.md](./design.md)

**Prerequisites merged:** PR1 (`BuildingContractProfileService.getUnmaskedForServer`, `formatPaymentWindow`), PR2 (`ContractRepository.findHandoverInventory`), PR4a (`contract_vehicles`, done screen).

## Global Constraints

- **Ask the user for approval before `npm install docxtemplater pizzip`** (AGENTS.md: dependency installs require explicit approval). Do not start Task 4 until approved.
- Snapshot and `storage_path` are never returned to clients; downloads only through 60-second signed URLs after scope checks.
- No PII in audit metadata, logs, error messages or test fixtures (fixtures use invented people).
- Template files are immutable per version; changes require a new version file + manifest bump.
- Storage writes use `upsert: false`.
- Functions/tables: RLS on, no client policies, `service_role` only; functions `security invoker`, `set search_path = ''`.
- Vietnamese copy with full diacritics; UI per `.agents/skills/zeno-house/references/ui-polish-workflow.md` with `frontend-design` + Hallmark; new tokens/primitives only after evaluation + approval.
- Cloud migration, Vault secrets, cron and type regeneration are separate human-run gates.

## Review Focus

1. **A placeholder with no data** (e.g. tenant has no `id_issued_place`) — must block issuance via `collectMissing`, and the renderer must throw rather than print an empty/raw tag. Pinned in Tasks 4–5.
2. **Upload succeeds, finalize fails** — file removed and pending row deleted; no orphan. Pinned in Task 7.
3. **Issuing twice concurrently** — unique partial index allows only one active document; second gets 409. Pinned in Task 6 (SQL) and Task 7.
4. **Manager downloads a document from another building** — 403 before signing a URL. Pinned in Task 8.
5. **Replacing a signed document** — only admin/owner, with reason; old row becomes `voided`, file kept. Pinned in Tasks 6–7.

---

### Task 1: Dependency gate

- [ ] **Step 1:** Ask the user: "PR4b cần cài `docxtemplater` và `pizzip` (server-side). Đồng ý cài không?" Stop until approved.
- [ ] **Step 2:** `npm install docxtemplater pizzip` → commit `package.json`, lockfile: `git commit -m "chore(deps): add docxtemplater and pizzip"`.

---

### Task 2: `vndToWords`

**Files:** Create `app/utils/format/vnd-words.ts`; Test `tests/utils/vnd-words.test.ts`.

**Interfaces:** `export function vndToWords(amount: number): string` — integer 0 ≤ amount < 10^12, first letter capitalized, suffix " đồng".

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/vnd-words.test.ts
import { describe, expect, it } from 'vitest'
import { vndToWords } from '~/utils/format/vnd-words'

describe('vndToWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [24, 'Hai mươi tư đồng'],
    [105, 'Một trăm lẻ năm đồng'],
    [1_000, 'Một nghìn đồng'],
    [1_005, 'Một nghìn không trăm lẻ năm đồng'],
    [1_500_000, 'Một triệu năm trăm nghìn đồng'],
    [3_000_000, 'Ba triệu đồng'],
    [10_250_000, 'Mười triệu hai trăm năm mươi nghìn đồng'],
    [1_000_000_000, 'Một tỷ đồng'],
  ])('%d → %s', (n, text) => {
    expect(vndToWords(n)).toBe(text)
  })

  it('rejects negatives and fractions', () => {
    expect(() => vndToWords(-1)).toThrow()
    expect(() => vndToWords(1.5)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// app/utils/format/vnd-words.ts
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const UNITS = ['', ' nghìn', ' triệu', ' tỷ']

function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const parts: string[] = []
  if (full || h > 0) parts.push(`${DIGITS[h]} trăm`)
  if (t > 1) {
    parts.push(`${DIGITS[t]} mươi`)
    if (u === 1) parts.push('mốt')
    else if (u === 4) parts.push('tư')
    else if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u]!)
  }
  else if (t === 1) {
    parts.push('mười')
    if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u]!)
  }
  else if (u > 0) {
    if (full || h > 0) parts.push('lẻ')
    parts.push(DIGITS[u]!)
  }
  return parts.join(' ')
}

export function vndToWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount >= 1e12) throw new Error('Amount must be an integer in [0, 1e12)')
  if (amount === 0) return 'Không đồng'
  const groups: number[] = []
  let rest = amount
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!
    if (g === 0) continue
    words.push(readTriple(g, i < groups.length - 1) + UNITS[i]!)
  }
  const text = words.join(' ').replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`
}
```

- [ ] **Step 4: Run tests** → PASS (adjust edge wording only if a case fails and the expected text is the accepted Vietnamese reading).

- [ ] **Step 5: Commit** `git commit -am "feat(format): vietnamese amount in words"` (add the new files).

---

### Task 3: Templates v1 + manifest

**Files:**
- Create: `server/assets/contract-templates/hop-dong-thue-phong/v1.docx`
- Create: `server/assets/contract-templates/phu-luc-hop-dong/v1.docx`
- Create: `server/assets/contract-templates/manifest.ts`
- Create: `scripts/inspect-docx-template.mjs` (prints placeholders found in `word/document.xml`)
- Test: `tests/server/contract-documents/templates.test.ts`

**Interfaces:**
```ts
export interface TemplateManifestEntry { key: 'hop-dong-thue-phong' | 'phu-luc-hop-dong'; version: number; file: string; requiredPaths: string[] }
export const CONTRACT_TEMPLATES: Record<TemplateManifestEntry['key'], TemplateManifestEntry>
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/contract-documents/templates.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { CONTRACT_TEMPLATES } from '../../../server/assets/contract-templates/manifest'

function documentText(file: string): string {
  const zip = new PizZip(readFileSync(resolve(process.cwd(), 'server/assets/contract-templates', file)))
  const xml = zip.file('word/document.xml')!.asText()
  return xml.replace(/<[^>]+>/g, '')
}

describe('contract templates', () => {
  for (const entry of Object.values(CONTRACT_TEMPLATES)) {
    it(`${entry.key} v${entry.version} has no docxtpl syntax and contains required paths`, () => {
      const text = documentText(entry.file)
      expect(text).not.toContain('{%')
      expect(text).not.toContain('loop.index')
      for (const path of entry.requiredPaths) expect(text).toContain(`{{${path}}}`)
    })
  }

  it('contract template drops free-parking sentence and has service/inventory tables', () => {
    const text = documentText(CONTRACT_TEMPLATES['hop-dong-thue-phong'].file)
    expect(text).not.toContain('parking.free_slots')
    expect(text).toContain('{{#services}}')
    expect(text).toContain('{{#inventory}}')
    expect(text).toContain('{{#vehicles}}')
    expect(text).toContain('{{#occupants}}')
    expect(text).toContain('Phụ lục 1')
  })
})
```

Note: placeholders are normalized to no inner spaces (`{{lessor.full_name}}`) during conversion so the test can match; Word may split a tag across runs — the text extraction above strips XML so split runs still match.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Convert the contract template**
  1. Copy `public/templates/HOP_DONG_THUE_PHONG_TEMPLATE.docx` to `server/assets/contract-templates/hop-dong-thue-phong/v1.docx`.
  2. Open in LibreOffice/Word (or edit `word/document.xml` directly after unzip) and apply design §4.2 changes:
     - Every `{{ x }}` → `{{x}}` (remove inner spaces).
     - Occupant row: first cell `{{#occupants}}{{index}}`, last cell `{{phone}}{{/occupants}}`; fields `{{full_name}}`, `{{date_of_birth}}`, `{{id_number}}`, `{{permanent_address}}`, `{{phone}}`.
     - Vehicle row: `{{#vehicles}}{{index}}` … `{{owner_name}}`, `{{plate_number}}`, `{{note}}{{/vehicles}}`.
     - Replace the "phí quản lý / dịch vụ" line and the "Đơn giá chỗ để xe: Miễn phí …" line with a 5-column table (STT, Dịch vụ, Đơn giá (VNĐ), Đơn vị, Ghi chú) with row `{{#services}}{{index}}` | `{{name}}` | `{{unit_price_display}}` | `{{unit_label}}` | `{{note}}{{/services}}`, followed by the paragraph "Số người, số xe tính phí được xác định theo thực tế hằng tháng và thể hiện trên hóa đơn."
     - Keep `{{services.electricity_price_display}}`, `{{services.water_price_display}}`, `{{services.water_unit}}` lines; rename to `{{utilities.electricity_price_display}}`, `{{utilities.water_price_display}}`, `{{utilities.water_unit}}` to avoid clashing with the `services` array.
     - Payment overdue sentence: replace "Nếu sau ngày {{ payment.overdue_day }} của tháng không đóng tiền," with "{{payment.overdue_clause}}" (builder produces either "Nếu sau ngày Z của tháng không đóng tiền," or "Nếu quá N ngày sau hạn thanh toán không đóng tiền,").
     - After the signature block and before "NỘI QUY", insert a page break and "PHỤ LỤC 1 — DANH SÁCH TÀI SẢN BÀN GIAO" (contract number line `Kèm theo Hợp đồng số {{contract.number}}`), a 6-column table (STT, Tên tài sản, SL, Tình trạng, Đơn giá (VNĐ), Ghi chú) with row `{{#inventory}}{{index}}` … `{{note}}{{/inventory}}`, then "Tổng giá trị tham chiếu: {{inventory_total_display}} VNĐ" and a paragraph `{{inventory_empty_text}}` (builder sets "" or "Không có tài sản bàn giao kèm theo.").
  3. Run `node scripts/inspect-docx-template.mjs server/assets/contract-templates/hop-dong-thue-phong/v1.docx` and confirm the placeholder list.

- [ ] **Step 4: Create the appendix template** `phu-luc-hop-dong/v1.docx` by copying v1 contract, keeping header ("CỘNG HÒA…", title replaced by "PHỤ LỤC HỢP ĐỒNG THUÊ PHÒNG"), then body:
  - `Số phụ lục: {{appendix.number}}` — `Kèm theo Hợp đồng số {{contract.number}}`
  - `Hôm nay, {{appendix.signed_date_text}}, các Bên gồm:` + Bên A / Bên B blocks (same fields as contract).
  - `Điều 1. Nội dung điều chỉnh: {{appendix.title}}` + paragraph `{{appendix.public_content}}`.
  - Changes table: `{{#changes}}{{index}}` | `{{label}}` | `{{before}}` | `{{after}}{{/changes}}`.
  - `Điều 2. Hiệu lực: Phụ lục có hiệu lực từ ngày {{appendix.effective_date}}. Các điều khoản khác của Hợp đồng giữ nguyên.`
  - Signature block.
  Remove everything else.

- [ ] **Step 5: Write manifest and inspect script**

```ts
// server/assets/contract-templates/manifest.ts
export interface TemplateManifestEntry {
  key: 'hop-dong-thue-phong' | 'phu-luc-hop-dong'
  version: number
  file: string
  requiredPaths: string[]
}

const PARTY = ['full_name', 'date_of_birth', 'permanent_address', 'id_number', 'id_issued_date', 'id_issued_place', 'phone']

export const CONTRACT_TEMPLATES: Record<TemplateManifestEntry['key'], TemplateManifestEntry> = {
  'hop-dong-thue-phong': {
    key: 'hop-dong-thue-phong',
    version: 1,
    file: 'hop-dong-thue-phong/v1.docx',
    requiredPaths: [
      'building.brand_name', 'building.address', 'contract.number', 'contract.signed_date_text',
      ...PARTY.map(f => `lessor.${f}`), ...PARTY.map(f => `tenant.${f}`),
      'room.number', 'contract.start_date', 'contract.end_date', 'contract.handover_date',
      'contract.monthly_rent_display', 'utilities.electricity_price_display', 'utilities.water_price_display', 'utilities.water_unit',
      'contract.vehicle_count', 'contract.occupant_count', 'terms.extra_occupant_fee_display', 'terms.drilling_fee_display',
      'payment.due_day_start', 'payment.due_day_end', 'payment.overdue_clause', 'terms.fingerprint_reset_fee_display',
      'payment.account_holder', 'payment.account_number', 'payment.bank_name', 'payment.transfer_content',
      'contract.deposit_display', 'contract.deposit_words', 'contract.deposit_months_equiv',
      'terms.notice_days', 'terms.deposit_refund_days', 'terms.renewal_months',
      'contract.signed_copies', 'contract.copies_per_party', 'inventory_total_display', 'inventory_empty_text',
    ],
  },
  'phu-luc-hop-dong': {
    key: 'phu-luc-hop-dong',
    version: 1,
    file: 'phu-luc-hop-dong/v1.docx',
    requiredPaths: [
      'appendix.number', 'contract.number', 'appendix.signed_date_text', 'appendix.title', 'appendix.public_content',
      'appendix.effective_date', ...PARTY.map(f => `lessor.${f}`), ...PARTY.map(f => `tenant.${f}`),
    ],
  },
}
```

```js
// scripts/inspect-docx-template.mjs
import { readFileSync } from 'node:fs'
import PizZip from 'pizzip'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/inspect-docx-template.mjs <file.docx>'); process.exit(1) }
const xml = new PizZip(readFileSync(file)).file('word/document.xml').asText()
const text = xml.replace(/<[^>]+>/g, '')
const tags = [...new Set([...text.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))].sort()
console.log(tags.join('\n'))
```

Ensure Nitro bundles `server/assets/**`: add to `nuxt.config.ts` `nitro.serverAssets` `[{ baseName: 'contract-templates', dir: './server/assets/contract-templates' }]` and read files via `useStorage('assets:contract-templates').getItemRaw(file)` at runtime (tests read from disk).

- [ ] **Step 6: Run tests** → PASS.

- [ ] **Step 7: Commit** `git add server/assets/contract-templates scripts/inspect-docx-template.mjs nuxt.config.ts tests/server/contract-documents/templates.test.ts && git commit -m "feat(contracts): versioned DOCX templates v1"`.

---

### Task 4: Renderer

**Files:** Create `server/services/contract-documents/render.ts`; Test `tests/server/contract-documents/render.test.ts`.

**Interfaces:** `export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer` — throws `DocxRenderError` (with tag names only, no values) on unresolved tags or leftovers.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/contract-documents/render.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { renderDocx } from '../../../server/services/contract-documents/render'
import { contractDocumentFixture } from '../../__fixtures__/contract-document-data'

const template = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates/hop-dong-thue-phong/v1.docx'))
const textOf = (buf: Buffer) => new PizZip(buf).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '')

describe('renderDocx', () => {
  it('renders all placeholders and loops', () => {
    const out = renderDocx(template, contractDocumentFixture())
    const text = textOf(out)
    expect(text).not.toMatch(/\{\{|\}\}/)
    expect(text).toContain('Người Thuê Giả Lập')
    expect(text).toContain('59X1 123.45')
    expect(text).toContain('Giường đơn')
    expect(text).toContain('Ba triệu đồng')
  })

  it('throws on missing data without leaking values', () => {
    const data = contractDocumentFixture()
    delete (data.tenant as Record<string, unknown>).id_issued_place
    expect(() => renderDocx(template, data)).toThrowError(/tenant\.id_issued_place/)
  })
})
```

Create `tests/__fixtures__/contract-document-data.ts` exporting `contractDocumentFixture()` with invented values for every path in the manifest plus arrays `occupants` (2 rows), `vehicles` (1 row, plate `59X1 123.45`), `services` (2 rows), `inventory` (1 row "Giường đơn"), `deposit_words: 'Ba triệu đồng'`, and `index` fields precomputed.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// server/services/contract-documents/render.ts
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

export class DocxRenderError extends Error {
  constructor(public readonly tags: string[]) {
    super(`Missing template data: ${tags.join(', ')}`)
  }
}

function resolvePath(scope: unknown, path: string): unknown {
  if (path === '.') return scope
  return path.split('.').reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), scope)
}

const parser = (tag: string) => {
  const path = tag.trim()
  return {
    get(scope: unknown, context: { scopeList: unknown[] }) {
      for (let i = context.scopeList.length - 1; i >= 0; i--) {
        const value = resolvePath(context.scopeList[i], path)
        if (value !== undefined) return value
      }
      return undefined
    },
  }
}

export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer {
  const missing: string[] = []
  const doc = new Docxtemplater(new PizZip(template), {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    parser,
    nullGetter(part: { value?: string; module?: string }) {
      if (!part.module) missing.push(String(part.value))
      return ''
    },
  })
  doc.render(data)
  if (missing.length > 0) throw new DocxRenderError([...new Set(missing)])
  const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
  const text = new PizZip(out).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '')
  if (/\{\{|\}\}/.test(text)) throw new DocxRenderError(['<unrendered>'])
  return out
}
```

`null`/empty-string values for optional cells (e.g. vehicle `note`) are allowed: the builder must emit `''` for optional fields (not `undefined`) so `nullGetter` only fires for truly missing data.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit** `git commit -m "feat(contracts): docx renderer with strict placeholders"` (add files).

---

### Task 5: Data builder + `collectMissing`

**Files:** Create `server/services/contract-documents/build-data.ts`, `server/services/contract-documents/missing.ts`; Test `tests/server/contract-documents/build-data.test.ts`.

**Interfaces:**
```ts
export interface ContractDocumentSources {
  contract: ContractWithDetails & { occupantCount: number; deposit: number; monthlyRent: number; startDate: string; endDate: string }
  building: Building
  lessor: BuildingContractProfile | null
  invoiceProfile: { bankName: string; accountHolder: string; accountNumber: string; transferContentTemplate: string; } | null
  tenant: Tenant                  // full access shape
  occupants: Tenant[]             // active roommates, full shape
  vehicles: ContractVehicle[]
  services: { name: string; pricingType: 'fixed_per_room' | 'per_person' | 'per_vehicle'; unit: string | null; amount: number; notes: string | null }[]
  inventory: HandoverInventory
  handoverDate: string
  signedDate: string               // YYYY-MM-DD
}
export function buildContractDocumentData(src: ContractDocumentSources): Record<string, unknown>
export type MissingCode = string  // 'lessor.id_number' | 'tenant.date_of_birth' | 'occupant[1].id_number' | 'invoice_profile' | 'billing.schedule' | 'terms.notice_days' ...
export function collectMissing(src: ContractDocumentSources): { code: MissingCode; label: string }[]
export function buildAppendixData(src: ContractDocumentSources, amendment: { sequenceNo: number; title: string; publicContent: string; effectiveDate: string; changes: { label: string; before: string; after: string }[] }): Record<string, unknown>
```

- [ ] **Step 1: Write failing tests** covering:
  - All manifest paths present in `buildContractDocumentData` output (compare against `CONTRACT_TEMPLATES[...].requiredPaths` with `resolvePath`).
  - `deposit_words` uses `vndToWords`; `deposit_months_equiv` = `deposit / monthlyRent` rounded to 1 decimal, shown with comma ("1,5").
  - `signed_date_text` = "ngày 05 tháng 12 năm 2026".
  - Tiered electricity → "Theo bậc thang của tòa nhà".
  - `payment.overdue_clause` both variants (via `formatPaymentWindow`).
  - `occupants` = primary tenant first, then roommates, each with `index`.
  - `services[].unit_label`: `fixed_per_room` → "phòng/tháng", `per_person` → "người/tháng", `per_vehicle` → "xe/tháng"; `note` = `''` when null.
  - `inventory_empty_text` set when empty; `inventory_total_display` via `inventoryTotalValue`.
  - `transfer_content` substitutes `{building_code}`, `{room_number}` and replaces `{invoice_code}`/`{period}` with "mã hóa đơn"/"kỳ".
  - `collectMissing`: lessor null → all 7 lessor codes + terms codes; tenant missing `id_issued_place` → `tenant.id_issued_place`; second roommate missing `id_number` → `occupant[2].id_number` with label containing the roommate's name; invoice profile null → `invoice_profile`; schedule missing → `billing.schedule`.

Use invented fixtures; write the assertions explicitly in the test file.

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** both modules per interfaces (reuse `formatPaymentWindow`, `vndToWords`, `formatCurrencyNumber`, `inventoryTotalValue`, `INVENTORY_CONDITION_LABELS`, `dayjs`). Date format `DD/MM/YYYY`. Emit `''` (not `undefined`) for optional cells.
- [ ] **Step 4: Run tests** → PASS; also run Task 4's render test against `buildContractDocumentData(fixtureSources)` output.
- [ ] **Step 5: Commit** `git commit -m "feat(contracts): contract document data builder and missing-field check"`.

---

### Task 6: Migration — bucket, table, guards, RPCs, cron

**Files:**
- Create: `supabase/migrations/20261111130000_contract_documents.sql`
- Create: `supabase/verification/contract_documents.sql`
- Test: `tests/config/contract-documents-migration.test.ts`

- [ ] **Step 1: Write the failing static test** asserting: bucket insert with `public = false` and the DOCX MIME; `create table if not exists public.contract_documents`; RLS + revoke; unique partial index name `contract_documents_one_active`; trigger `contract_documents_guard`; functions `reserve_contract_document`, `finalize_contract_document`, `mark_contract_document_signed`, `void_contract_document`, `claim_stale_contract_documents` each granted only to `service_role`; `cron.schedule('contract-documents-cleanup'`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write the migration** with:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-documents', 'contract-documents', false, 10485760,
        array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete restrict,
  type text not null check (type in ('contract', 'appendix')),
  amendment_id uuid references public.contract_amendments(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status text not null default 'pending' check (status in ('pending', 'issued', 'signed', 'voided')),
  template_key text not null,
  template_version integer not null check (template_version > 0),
  storage_path text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  snapshot jsonb not null,
  signed_date date not null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(trim(void_reason)) >= 10),
  replaces_document_id uuid references public.contract_documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint contract_documents_appendix_check check ((type = 'appendix') = (amendment_id is not null)),
  constraint contract_documents_issued_fields check (status = 'pending' or (storage_path is not null and sha256 is not null and issued_at is not null)),
  constraint contract_documents_voided_fields check (status <> 'voided' or (voided_at is not null and void_reason is not null))
);

create unique index if not exists contract_documents_one_active
  on public.contract_documents (contract_id, type, coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending', 'issued', 'signed');
create unique index if not exists contract_documents_version_uq
  on public.contract_documents (contract_id, type, coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid), version_no);
```

Guard trigger `contract_documents_guard` (`before update or delete`): on delete allow only `old.status = 'pending'`; on update reject changes to `contract_id, building_id, type, amendment_id, version_no, template_key, template_version, snapshot, signed_date, replaces_document_id`; allow `storage_path/sha256/size_bytes/issued_at/issued_by` changes only when `old.status = 'pending'`; allowed transitions: `pending→issued`, `issued→signed`, `issued→voided`, `signed→voided`; anything else raises `CONTRACT_DOCUMENT_IMMUTABLE`.

RPCs (all `security invoker`, `set search_path = ''`, revoke from `public, anon, authenticated`, grant `service_role`):
- `reserve_contract_document(p_contract_id uuid, p_type text, p_amendment_id uuid, p_template_key text, p_template_version integer, p_snapshot jsonb, p_signed_date date, p_actor_id uuid, p_replaces_document_id uuid, p_void_reason text) returns public.contract_documents` — `pg_advisory_xact_lock(hashtextextended('contract_documents:' || p_contract_id::text, 0))`; find active doc for the key; if exists and `p_replaces_document_id is distinct from active.id` → `raise 'CONTRACT_DOCUMENT_ACTIVE_EXISTS' using errcode='23505'`; if `p_replaces_document_id` not null → update it to `voided` with `p_void_reason`, `voided_by`, `voided_at`; `version_no = coalesce(max, 0) + 1`; insert `pending` with `building_id` from contract; return row.
- `finalize_contract_document(p_document_id uuid, p_storage_path text, p_sha256 text, p_size_bytes integer, p_actor_id uuid)` — update pending → issued (`issued_by = p_actor_id`, `issued_at = now()`), else `CONTRACT_DOCUMENT_STATE_INVALID`.
- `mark_contract_document_signed(p_document_id uuid, p_actor_id uuid)` — issued → signed.
- `void_contract_document(p_document_id uuid, p_reason text, p_actor_id uuid)` — issued|signed → voided.
- `claim_stale_contract_documents(p_older_than interval)` — `select … where status='pending' and created_at < now() - p_older_than for update skip locked`.

Cron (unschedule existing by name first, as in `harden_event_audit`):

```sql
select cron.schedule(
  'contract-documents-cleanup',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'nitro_scheduler_base_url')
        || '/api/internal/contract-documents/cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-contract-documents-cleanup-secret', (
          select decrypted_secret from vault.decrypted_secrets where name = 'contract_documents_cleanup_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
```

- [ ] **Step 4: Verification script** (`begin; … rollback;`): reserve → finalize → sign → void; second reserve while active → `CONTRACT_DOCUMENT_ACTIVE_EXISTS`; replace with reason → old voided, new version 2; update `snapshot` on issued → `CONTRACT_DOCUMENT_IMMUTABLE`; delete issued → blocked; delete pending → allowed; `claim_stale` returns an old pending row; appendix without `amendment_id` → check violation; grants.

- [ ] **Step 5: Run static test** → PASS. **Commit** `git commit -m "feat(db): contract_documents table, bucket, RPCs and cleanup cron"`.

---

### Task 7: Repository + service + capabilities + audit

**Files:**
- Create: `server/repositories/contract-documents.ts`
- Create: `server/services/contract-documents/index.ts`
- Create: `server/services/contract-documents/sources.ts` (loads `ContractDocumentSources`)
- Modify: `app/utils/constants/permissions.ts`, `app/utils/constants/audit.ts`
- Create: `app/types/contract-documents.ts`, `app/utils/mappers/contract-documents.ts`
- Test: `tests/server/contract-documents/service.test.ts`

**Interfaces:**
- DTO `ContractDocument { id, contractId, type, amendmentId, versionNo, status, templateKey, templateVersion, signedDate, issuedAt, issuedBy, signedAt, signedBy, voidedAt, voidReason, replacesDocumentId, sizeBytes }` (no `snapshot`, no `storagePath`).
- Service:
  ```ts
  ContractDocumentService.list(event, user, contractIdentifier): Promise<ContractDocument[]>
  ContractDocumentService.check(event, user, contractIdentifier, input: { type; amendment_id? }): Promise<{ ready: boolean; missing: { code: string; label: string }[] }>
  ContractDocumentService.preview(event, user, contractIdentifier, input: { type; amendment_id?; signed_date }): Promise<{ filename: string; buffer: Buffer }>
  ContractDocumentService.issue(event, user, contractIdentifier, input: { type; amendment_id?; signed_date; request_id; replaces_document_id?; void_reason? }): Promise<ContractDocument>
  ContractDocumentService.downloadUrl(event, user, documentId): Promise<{ url: string; expiresIn: number }>
  ContractDocumentService.sign(event, user, documentId): Promise<ContractDocument>
  ContractDocumentService.void(event, user, documentId, reason: string): Promise<ContractDocument>
  ContractDocumentService.cleanupStale(event): Promise<{ removed: number }>
  ```
- Capabilities: owner list gains `contract-documents.read`, `contract-documents.issue`, `contract-documents.sign`, `contract-documents.void`; manager list gains `contract-documents.read`, `contract-documents.issue`.
- Audit: `CONTRACT_DOCUMENT_ISSUED: 'contract.document.issued'`, `CONTRACT_DOCUMENT_SIGNED: 'contract.document.signed'`, `CONTRACT_DOCUMENT_VOIDED: 'contract.document.voided'`.

- [ ] **Step 1: Write failing service tests** (mock repository, sources loader, renderer, storage):
  - `check` returns missing from `collectMissing`.
  - `issue` with missing → 422 `CONTRACT_DOCUMENT_INCOMPLETE` and no reserve call.
  - Happy path order: `reserve` → `upload(path = ${buildingId}/${contractId}/${docId}.docx, upsert false)` → `finalize(sha256 of buffer)` → audit with `{ document_id, type, version_no, template_version, sha256 }` and no snapshot values.
  - Upload throws → `deletePending(docId)` called, error rethrown.
  - Finalize throws → `removeObject(path)` and `deletePending(docId)` called.
  - Replay: `request_id` already completed for same actor (via `audit_operations` begin/complete using `AuditOperationRepository`, key `contract.document:<request_id>`) → returns existing document, no new reserve.
  - Manager `sign`/`void` → 403; owner `void` on signed → allowed; reason < 10 chars → 422.
  - `downloadUrl` checks `assertBuildingScope(document.buildingId, 'read')` before `createSignedUrl(path, 60)`.
  - `preview` does not call reserve/upload.
  - Appendix: amendment status must be `scheduled|applied`, else 409.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**
  - Repository: RPC wrappers (`reserve`, `finalize`, `markSigned`, `void`, `claimStale`), `deletePending(id)` (`delete … eq id eq status pending`), `findById`, `listByContract`, storage helpers (`upload(path, buffer)` with `contentType` DOCX + `upsert: false`, `removeObject(path)`, `signedUrl(path, 60)`). Map RPC errors: `CONTRACT_DOCUMENT_ACTIVE_EXISTS` → 409 "Hợp đồng đã có tài liệu đang hiệu lực. Hủy bản cũ để phát hành bản thay thế."; `CONTRACT_DOCUMENT_STATE_INVALID`/`CONTRACT_DOCUMENT_IMMUTABLE` → 409 "Trạng thái tài liệu không cho phép thao tác này.".
  - Sources loader: contract (`ContractRepository.findByIdentifier`), building, `BuildingContractProfileService.getUnmaskedForServer`, invoice profile row, tenant + active roommates (full rows via `TenantRepository` — bypassing the access-level redaction is intentional and server-only), vehicles, enabled contract services joined with catalog, `findHandoverInventory`, handover date from the contract's `handover_in` reading date.
  - Template bytes: `useStorage('assets:contract-templates').getItemRaw(entry.file)`.
  - Idempotency: `AuditOperationRepository.begin` with key `contract.document:<request_id>`; if the returned op is `completed` with `entity_id` and same actor → return that document; on success `complete` with `entity_id`.
  - Filename: `HD-${contract.contractCode}-v${versionNo}.docx` / `PL${seq}-${contract.contractCode}-v${versionNo}.docx`.

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(contracts): contract document service with compensation and idempotency"`.

---

### Task 8: API routes + cleanup worker

**Files:**
- Create: `server/api/contracts/[id]/documents/index.get.ts`, `index.post.ts`, `check.post.ts`, `preview.post.ts`
- Create: `server/api/contract-documents/[docId]/download.get.ts`, `sign.post.ts`, `void.post.ts`
- Create: `server/api/internal/contract-documents/cleanup.post.ts`
- Create: `app/utils/validators/contract-documents.ts`
- Modify: `nuxt.config.ts` (`runtimeConfig.contractDocumentsCleanupSecret: ''`)
- Test: `tests/server/contract-documents/api.test.ts`, `tests/server/contract-documents/cleanup.test.ts`

**Interfaces:**
- Validators: `contractDocumentRequestSchema { type: 'contract'|'appendix', amendment_id?: uuid, signed_date: YYYY-MM-DD }` with refine appendix⇔amendment_id; `contractDocumentIssueSchema` = request + `request_id: uuid`, `replaces_document_id?: uuid`, `void_reason?: string ≥ 10` (required when `replaces_document_id`); `contractDocumentVoidSchema { reason: string trim ≥ 10 ≤ 500 }`.
- `preview.post.ts` responds with the buffer: `setHeader('Content-Type', DOCX_MIME)`, `setHeader('Content-Disposition', \`attachment; filename="${filename}"\`)`, `return buffer`.
- Cleanup: header `x-contract-documents-cleanup-secret` must equal `useRuntimeConfig(event).contractDocumentsCleanupSecret` (non-empty) else 403; returns `{ data: { removed } }`.

- [ ] **Step 1: Write failing tests** — list response contains no `snapshot`/`storagePath`; issue validates and forwards; void requires reason; preview sets DOCX headers; cleanup 403 on wrong/empty secret and calls service on correct secret.
- [ ] **Step 2–4:** implement, run, regenerate `docs/api-inventory.md`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): contract document endpoints and cleanup worker"`.

---

### Task 9: UI — documents section, issue dialog, entry points (UI polish gate)

**Files:**
- Create: `app/composables/contracts/useContractDocuments.ts`
- Create: `app/components/contracts/ContractDocumentsSection.vue`
- Create: `app/components/contracts/ContractDocumentIssueDialog.vue`
- Modify: `app/pages/dashboard/contracts/[code]/index.vue` (section `documents` after `overview`, nav "Tài liệu")
- Modify: `app/pages/dashboard/contracts/create.vue` (done-screen button opens the dialog)
- Modify: `app/components/contracts/ContractAmendmentsSection.vue` ("Xuất phụ lục" on scheduled/applied amendments)
- Test: `tests/composables/useContractDocuments.test.ts`, `tests/components/contracts/ContractDocumentIssueDialog.test.ts`, `tests/components/contracts/ContractDocumentsSection.test.ts`

**Interfaces:**
- `useContractDocuments(contractIdentifier)` → `{ documents, loading, check(input), preview(input) (triggers browser download via Blob), issue(input) (stable request_id per dialog open), download(docId) (opens signed URL), sign(docId), void(docId, reason) }`.
- Dialog props `{ open: boolean; contractId: string; type: 'contract' | 'appendix'; amendmentId?: string; replaceDocument?: ContractDocument | null }`; emits `issued: [ContractDocument]`, `close`.

- [ ] **Step 1: UI polish workflow** (`frontend-design` + Hallmark): documents list density, status badges (`UiStatusBadge`), missing-data checklist with links, preview vs issue hierarchy, replace/void confirmation copy (warn that a signed contract should usually get an appendix), mobile. Record in `docs/changes/contract-documents/verification.md`.
- [ ] **Step 2: Write failing tests**:
  - Dialog: on open calls `check`; with missing shows each label and link (tenant → `/dashboard/tenants/{code}/edit`; lessor/terms → `settings#contract-profile` when `building-contract-profile.write`, else text "Liên hệ chủ nhà để bổ sung"); "Phát hành" disabled while missing; ready → "Xem trước (không lưu)" calls `preview`, "Phát hành" calls `issue` once with stable `request_id` across a retry; replace mode requires reason ≥ 10 chars.
  - Section: renders versions newest first with status labels "Đã phát hành", "Đã ký", "Đã hủy"; "Đánh dấu đã ký" only for `issued` + `contract-documents.sign`; "Hủy & phát hành lại" only with `contract-documents.void`; download calls `download`.
- [ ] **Step 3–4:** implement and run tests.
- [ ] **Step 5: Visual QA** (ask before starting a local runtime): missing-data, preview download opens in Word/LibreOffice and shows correct content, issue, sign, void + replace, appendix export, mobile. Record in `verification.md`.
- [ ] **Step 6: Commit** `git commit -m "feat(ui): contract documents section and issue dialog"`.

---

### Task 10: Full verification and docs

- [ ] **Step 1:** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`.
- [ ] **Step 2:** Complete `verification.md` (frontmatter `type: Change Verification`): Local; UI decisions; Visual QA; Privacy (no snapshot in API responses, no PII in audit/logs, fixtures invented); Cloud gates — Vault secret `contract_documents_cleanup_secret` + runtime config set, migration applied, verification script output, cron job present (`select * from cron.job where jobname='contract-documents-cleanup'`), types regenerated + casts removed, app deployed, smoke on staging with invented data (issue → download → sign → void → replace).
- [ ] **Step 3:** Update `index.md` status → `implementation-review`.
- [ ] **Step 4: Commit** `git commit -m "docs(changes): PR4b verification evidence"`.
- [ ] **Step 5: Cloud gate (human-run)** as above; on acceptance create `docs/capabilities/contract-documents.md`, update `contracts-ui`, `contracts-api`, `supabase-scheduled-workers`; archive.
