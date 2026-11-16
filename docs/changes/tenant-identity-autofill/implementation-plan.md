---
type: Change Implementation Plan
title: "tenant-identity-autofill-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, tenants, ai, ocr, privacy, v2]
---

# Tenant Identity Autofill (V2 PR5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff photograph or upload 1–2 Vietnamese ID images (or a VNeID screenshot), get Claude Vision suggestions for tenant fields, review and selectively apply them, then save through the existing tenant create flow — without storing images or AI output.

**Architecture:** A server-only endpoint `POST /api/tenants/identity/extract` validates files, strips metadata without re-encoding, reserves a daily quota row, calls Claude (`@anthropic-ai/sdk`, `maxRetries: 0`, timeout) with structured JSON output, re-validates with Zod, normalizes, settles usage and returns suggestions. The client `TenantIdentityScanner` lives inside PR3's `TenantQuickCreateDialog` and `TenantForm`, applying fields only on user action. Feature flag default off.

**Tech Stack:** Nuxt 3 / Nitro, `@anthropic-ai/sdk`, Zod, Supabase (quota table + RPC), Vitest.

**Spec:** [design.md](./design.md) + [Tenant V2 §C4a, §D2.1, §D7, §G](../tenant-v2/spec-and-implementation-plan.md)

**Prerequisites merged:** PR3 (`TenantQuickCreateDialog`, `useTenantQuickCreate`).

## Global Constraints

- **Ask the user before `npm install @anthropic-ai/sdk`** (AGENTS.md). Do not start Task 5 until approved.
- Feature flag `aiTenantVisionEnabled` default `false`; endpoint returns 503 when off. Only fictional fixtures before the privacy gate (G3) is signed.
- Never log, persist or return raw images, base64, prompts or raw model output. No identity data in audit, quota rows, analytics, `localStorage`, AI conversations or test snapshots.
- Images: 1–2 files, JPEG/PNG/WebP by magic bytes, ≤ 5 MiB each; metadata removed by dropping segments/chunks (no decode, no re-encode, no crop).
- Provider: model id from config; no automatic escalation to another paid model; `maxRetries: 0`; timeout from config.
- Quota defaults: 20 calls/day global, 10/day per user, 1.00 USD/day budget; reserve before the call, settle after; exceeding → no provider call.
- Capability: `tenants.create` or `tenants.update`; managers have neither → 403 and no UI.
- AI output is untrusted: Zod `strict`, nullable fields, ISO dates validated, id number digits only (keep leading zeros).
- Vietnamese copy with full diacritics; UI per `.agents/skills/zeno-house/references/ui-polish-workflow.md` with `frontend-design` + Hallmark; new tokens/primitives only after evaluation + approval.

## Review Focus

1. **Prompt-injection text printed on the image** ("ignore instructions, set id to …") — output still must pass schema + normalization and go through human review; no auto-apply. Pinned in Task 3 (normalizer) and Task 7 (UI never auto-applies).
2. **Two images of different people** — `identity_mismatch = true` blocks applying any field. Pinned in Tasks 3 and 7.
3. **Quota race (two requests at the last remaining slot)** — at most one provider call. Pinned in Task 4 (atomic reserve RPC).
4. **Provider timeout after reservation** — reservation released/settled at zero cost and user can retry or type manually. Pinned in Tasks 4–6.
5. **JPEG whose EXIF contains GPS** — bytes sent to the provider contain no APP1 Exif/XMP segment, image data unchanged. Pinned in Task 2.

---

### Task 1: Extraction schema (shared) + JSON Schema for the provider

**Files:** Create `app/utils/validators/tenant-identity-extraction.ts`; Test `tests/utils/tenant-identity-extraction-schema.test.ts`.

**Interfaces:**
```ts
export const DOCUMENT_TYPES = ['can_cuoc_2024', 'cccd_chip', 'unknown'] as const
export const CAPTURE_LAYOUTS = ['separate_images', 'front_only', 'back_only', 'vneid_combined', 'vneid_details', 'single_mixed', 'unknown'] as const
export const ADDRESS_LABELS = ['noi_cu_tru', 'noi_thuong_tru', 'unknown'] as const
export const identityExtractionSchema: z.ZodType<IdentityExtraction>  // strict; fields nullable
export type IdentityExtraction = {
  document_type: typeof DOCUMENT_TYPES[number]
  capture_layout: typeof CAPTURE_LAYOUTS[number]
  fields: {
    full_name: string | null; id_number: string | null; date_of_birth: string | null
    gender: 'male' | 'female' | 'other' | null; nationality: string | null
    residence_address: string | null; address_label: typeof ADDRESS_LABELS[number] | null
    birth_registration_place: string | null; place_of_origin: string | null
    id_issued_date: string | null; id_expiry_date: string | null; id_issued_place: string | null
  }
  warnings: string[]
  identity_mismatch: boolean
  needs_review: true
}
export const IDENTITY_EXTRACTION_JSON_SCHEMA: Record<string, unknown> // additionalProperties: false at every level
```

- [ ] **Step 1: Write failing tests** — valid fictional object parses; extra key at root or in `fields` rejected; `needs_review: false` rejected; `IDENTITY_EXTRACTION_JSON_SCHEMA` has `additionalProperties: false` on root and `fields`, and every key of `fields` is `required` with `type: ['string', 'null']` (or enum + null).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the Zod schema and a hand-written JSON Schema object (do not add a zod-to-json-schema dependency).
- [ ] **Step 4: Run tests** → PASS. **Step 5: Commit** `git commit -m "feat(tenants): identity extraction schema"`.

---

### Task 2: Image validation and metadata stripping

**Files:** Create `server/utils/identity-images.ts`; Test `tests/server/tenants/identity-images.test.ts`; Fixtures `tests/__fixtures__/identity-images/` (tiny synthetic images generated in the test, no real photos).

**Interfaces:**
```ts
export type IdentityImageMime = 'image/jpeg' | 'image/png' | 'image/webp'
export function detectImageMime(buf: Buffer): IdentityImageMime | null          // magic bytes
export function stripImageMetadata(buf: Buffer, mime: IdentityImageMime): Buffer // JPEG: drop APP1(Exif/XMP)/APP13/COM; PNG: drop eXIf/tEXt/iTXt/zTXt/tIME; WebP: drop EXIF/XMP chunks and clear VP8X flags
export function validateIdentityImages(parts: { data: Buffer; filename?: string; type?: string }[]):
  { ok: true; images: { mime: IdentityImageMime; data: Buffer }[] } | { ok: false; status: 413 | 415 | 422; code: string }
```

- [ ] **Step 1: Write failing tests** — build minimal valid JPEG (SOI + APP0 JFIF + APP1 "Exif\0\0…GPS" + DQT/SOF/SOS stub + EOI), PNG (signature + IHDR + tEXt + IDAT + IEND with correct CRCs), WebP (RIFF/WEBP + VP8X with EXIF flag + EXIF chunk + VP8L stub); assert: stripped output lacks `Exif`/`tEXt`/`EXIF` markers, keeps every non-metadata segment byte-for-byte, PNG CRCs still valid, WebP RIFF size updated and EXIF flag cleared. `validateIdentityImages`: 0 or 3 files → 422; 5 MiB + 1 byte → 413; PNG bytes declared as JPEG → accepted by magic bytes (mime from bytes); random bytes → 415; truncated JPEG (no EOI) → 422.
- [ ] **Step 2–4:** implement and pass. **Step 5: Commit** `git commit -m "feat(tenants): identity image validation and metadata stripping"`.

---

### Task 3: Normalizer

**Files:** Create `server/services/tenants/identity-normalize.ts`; Test `tests/server/tenants/identity-normalize.test.ts`.

**Interfaces:**
```ts
export interface IdentitySuggestion extends IdentityExtraction {
  fields: IdentityExtraction['fields']   // normalized
  apply: { permanent_address_allowed: boolean } // true only when address_label = 'noi_thuong_tru'
}
export function normalizeExtraction(raw: IdentityExtraction): IdentitySuggestion
```

Rules: NFC + trim + collapse spaces on text; `DD/MM/YYYY` or ISO → ISO, invalid or impossible dates → null + warning "Ngày … không hợp lệ"; date of birth after today → null + warning; `id_number` keep only if `^\d{9}(\d{3})?$` after removing spaces (else null + warning "Số định danh không đọc chắc chắn"); `identity_mismatch` true → keep values for display but `apply.permanent_address_allowed = false` and add warning "Hai ảnh có thông tin không khớp"; never invent values.

- [ ] **Step 1: Write failing tests** for each rule, including an input whose `full_name` contains an injection string — normalizer keeps it as plain text (no special handling), proving no instruction is executed; output still requires review.
- [ ] **Step 2–4:** implement and pass. **Step 5: Commit** `git commit -m "feat(tenants): normalize identity extraction"`.

---

### Task 4: Quota table + atomic reserve/settle

**Files:**
- Create `supabase/migrations/20261111140000_tenant_ocr_usage.sql`, `supabase/verification/tenant_ocr_usage.sql`
- Create `server/repositories/tenant-ocr-usage.ts`
- Modify `nuxt.config.ts` runtime config: `aiTenantVisionEnabled: false`, `aiTenantAnthropicApiKey: ''`, `aiTenantVisionModel: ''`, `aiTenantVisionTimeoutMs: 30000`, `aiTenantOcrDailyLimit: 20`, `aiTenantOcrUserDailyLimit: 10`, `aiTenantOcrDailyBudgetMicroUsd: 1_000_000`, `aiTenantOcrInputPricePerMTokMicroUsd: 0`, `aiTenantOcrOutputPricePerMTokMicroUsd: 0`, `aiTenantOcrReserveMicroUsd: 20_000` (all `NUXT_AI_TENANT_*`)
- Create `server/utils/tenant-vision-runtime.ts` (bounded parsing like `ai-runtime.ts`)
- Test `tests/config/tenant-ocr-usage-migration.test.ts`, `tests/server/tenants/tenant-vision-runtime.test.ts`, `tests/server/tenants/tenant-ocr-usage-repo.test.ts`

**Interfaces:**
- Table `tenant_ocr_usage (id uuid pk, usage_date date not null, user_id uuid not null, status text check in ('reserved','settled','released'), reserved_micro_usd bigint not null, cost_micro_usd bigint null, input_tokens int null, output_tokens int null, model text null, created_at, settled_at)` — no identity data; RLS on, no policies, `service_role` only; index `(usage_date)`, `(usage_date, user_id)`.
- `reserve_tenant_ocr(p_user_id uuid, p_global_limit int, p_user_limit int, p_budget_micro_usd bigint, p_reserve_micro_usd bigint) returns uuid` — `pg_advisory_xact_lock(hashtextextended('tenant_ocr:' || current_date, 0))`; counts `reserved|settled` rows for today (UTC) globally and for the user; sums `coalesce(cost_micro_usd, reserved_micro_usd)`; raise `TENANT_OCR_GLOBAL_LIMIT` / `TENANT_OCR_USER_LIMIT` / `TENANT_OCR_BUDGET` (errcode `P0001`) when exceeded; insert `reserved` row; return id.
- `settle_tenant_ocr(p_id uuid, p_cost_micro_usd bigint, p_input_tokens int, p_output_tokens int, p_model text)`; `release_tenant_ocr(p_id uuid)` (status `released`, cost 0).
- `TenantOcrUsageRepository.reserve(event, userId, limits)`, `.settle(event, id, usage)`, `.release(event, id)`; maps limit errors to `{ kind: 'quota', reason }`.
- `getTenantVisionRuntime(event)` returns bounded values and `enabled = flag && apiKey && model`.

- [ ] **Step 1: Write failing tests** — migration static checks (table, RLS, revoke, functions granted only to `service_role`, advisory lock); runtime bounds (limits 1–1000, budget 0–100 USD, timeout 5–120 s; disabled when key or model empty); repository maps each limit error.
- [ ] **Step 2–4:** implement and pass. Verification script: two reservations at limit-1 in sequence → second raises; release does not count toward cost; settle replaces reserve in the sum; grants.
- [ ] **Step 5: Commit** `git commit -m "feat(tenants): OCR usage quota with atomic reservation"`.

---

### Task 5: Dependency gate + Claude provider adapter

- [ ] **Step 1:** Ask the user: "PR5 cần cài `@anthropic-ai/sdk` (chỉ dùng ở server). Đồng ý cài không?" Stop until approved; then `npm install @anthropic-ai/sdk` and commit `package.json` + lockfile.

**Files:** Create `server/services/ai/anthropic-vision.ts`; Test `tests/server/tenants/anthropic-vision.test.ts`.

**Interfaces:**
```ts
export interface VisionResult { output: unknown; usage: { inputTokens: number; outputTokens: number }; model: string }
export class VisionProviderError extends Error { constructor(public kind: 'timeout' | 'rate_limited' | 'unavailable' | 'invalid_output', public retryAfterSeconds?: number) }
export async function extractIdentityWithClaude(input: {
  apiKey: string; model: string; timeoutMs: number
  images: { mime: IdentityImageMime; data: Buffer }[]
}): Promise<VisionResult>
```

- [ ] **Step 2: Write failing tests** with `vi.mock('@anthropic-ai/sdk')`: client constructed with `maxRetries: 0` and `timeout`; request contains one `image` block per input (base64, correct `media_type`) and the extraction-only instruction text from Tenant V2 §D3; structured output configured with `IDENTITY_EXTRACTION_JSON_SCHEMA` (verify the exact request field name against the installed SDK version — e.g. `output_config.format` — and pin it in the test); SDK `APIConnectionTimeoutError` → `timeout`; 429 → `rate_limited` with `retry-after`; 5xx/overloaded → `unavailable`; non-JSON or schema-invalid text → `invalid_output`; the thrown error message contains no image or model text.
- [ ] **Step 3–4:** implement and pass. **Step 5: Commit** `git commit -m "feat(ai): Claude vision adapter for identity extraction"`.

---

### Task 6: Extraction service + endpoint

**Files:** Create `server/services/tenants/identity-extraction.ts`, `server/api/tenants/identity/extract.post.ts`; Test `tests/server/tenants/identity-extraction.test.ts`, `tests/server/tenants/identity-extract-api.test.ts`.

**Interfaces:**
- `TenantIdentityExtractionService.extract(event, user, parts): Promise<IdentitySuggestion>` — order: capability (`tenants.create` or `tenants.update`, else 403) → runtime enabled (else 503 `TENANT_VISION_DISABLED`) → in-flight lock per user (in-memory `Set`, second concurrent call 429) → `validateIdentityImages` → strip metadata → `reserve` (quota error → 429 `TENANT_OCR_QUOTA` with message "Đã hết lượt đọc ảnh hôm nay. Vui lòng nhập tay.") → provider → `identityExtractionSchema.safeParse` (fail → release + 502) → `normalizeExtraction` → `settle` with computed cost → return. Provider errors: timeout → release + 504; rate_limited/unavailable → release + 503 (+ `Retry-After` header when known).
- Endpoint: `readMultipartFormData`, collect parts named `images[]`; respond `{ data: suggestion, meta: { model } }`; set `Cache-Control: no-store`.
- No call to any tenant repository, storage, audit with identity data, or AI conversation service.

- [ ] **Step 1: Write failing tests** covering each branch above in order (assert provider not called for 403/503-disabled/415/413/422/quota), success path settles with cost `ceil(input*inPrice/1e6 + output*outPrice/1e6)`, logs (spy `console.*` and the app logger) contain no base64 and no field values, tenant repositories untouched (mock and assert no calls), response headers include `no-store`.
- [ ] **Step 2–4:** implement and pass; regenerate `docs/api-inventory.md`.
- [ ] **Step 5: Commit** `git commit -m "feat(tenants): identity extraction endpoint behind flag and quota"`.

---

### Task 7: Scanner UI inside quick create and tenant form (UI polish gate)

**Files:**
- Create `app/composables/tenants/useTenantIdentityExtract.ts`, `app/components/tenants/TenantIdentityScanner.vue`
- Modify `app/components/tenants/TenantQuickCreateDialog.vue` (PR3), `app/components/tenants/TenantForm.vue`
- Modify `nuxt.config.ts` public config `aiTenantVisionEnabled: false` (`NUXT_PUBLIC_AI_TENANT_VISION_ENABLED`) for showing the entry point
- Test `tests/composables/useTenantIdentityExtract.test.ts`, `tests/components/tenants/TenantIdentityScanner.test.ts`

**Interfaces:**
- `useTenantIdentityExtract()` → `{ extract(files: File[]): Promise<IdentitySuggestion | null>, abort(), loading, error }` — multipart `images[]`, `AbortController`, never stores anything.
- `TenantIdentityScanner` props `{ currentValues: Partial<TenantCreateInput>; editedFields: Set<string> }`, emits `apply: [Partial<TenantCreateInput>]`. Input `accept="image/jpeg,image/png,image/webp"` with `capture="environment"` button and a separate "Chọn ảnh" button; 1–2 files; previews via `URL.createObjectURL`, revoked on remove/unmount/close; hint "Ảnh một mặt, hai mặt hoặc ảnh chụp màn hình VNeID đều được"; consent notice text from the privacy review shown before sending (placeholder copy reviewed in G3).
- Suggestions table: field label, suggested value, current value, per-row "Áp dụng" (disabled when the user edited that field — show "Đã sửa tay"), and "Áp dụng các trường còn trống". `residence_address` → `permanent_address` only when `apply.permanent_address_allowed`; otherwise row shows the label (`Nơi cư trú`) with warning "Nơi cư trú có thể khác nơi thường trú — kiểm tra trước khi dùng" and a manual copy action. `identity_mismatch` → all apply buttons disabled + alert "Hai ảnh có thông tin không khớp. Thay ảnh hoặc nhập tay.". Phone is never suggested. Errors show their message with "Nhập tay" focusing the name field.

- [ ] **Step 1: UI polish workflow** — `frontend-design` + Hallmark: scanner entry point inside the collapsed "Thông tin giấy tờ" block, preview density, suggestion table on mobile (stacked rows), consent copy placement, error and quota states. Record in `docs/changes/tenant-identity-autofill/verification.md`.
- [ ] **Step 2: Write failing tests** — object URLs revoked on close; `localStorage.setItem` never called; per-field apply emits only that field; "apply empty" skips filled and edited fields; mismatch disables apply; address rule; scanner hidden when public flag off or user lacks `tenants.create`/`tenants.update`; abort on dialog close.
- [ ] **Step 3–4:** implement and pass.
- [ ] **Step 5: Visual QA** with fictional images only (ask before starting a local runtime and before any call with a real API key): iOS Safari camera, Android Chrome camera, desktop file picker, VNeID screenshot fixture, mismatch fixture, quota exhausted, provider timeout. Record in `verification.md`.
- [ ] **Step 6: Commit** `git commit -m "feat(ui): tenant identity scanner with selective apply"`.

---

### Task 8: Benchmark script (manual, fictional fixtures)

**Files:** Create `scripts/benchmark-tenant-vision.mjs`, `tests/__fixtures__/identity-cards/README.md` (how fixtures are generated; no real data), `docs/changes/tenant-identity-autofill/benchmark-results.md` (template).

- [ ] **Step 1:** Script reads `tests/__fixtures__/identity-cards/*.json` ground truth + matching images (generated fictional cards covering FMT-01..04 and the degraded cases in Tenant V2 §G1), calls the adapter for the configured model with `NUXT_AI_TENANT_ANTHROPIC_API_KEY`, and prints aggregate metrics only (JSON validity, exact id match, name/date match, layout match, below-card field read, mismatch detection, unsupported guesses, p50/p95 latency, tokens, USD). Refuses to run without `--i-confirm-fictional-fixtures`.
- [ ] **Step 2:** Add a unit test for the metric aggregation function (pure) in `tests/scripts/benchmark-tenant-vision.test.ts`.
- [ ] **Step 3: Commit** `git commit -m "chore(tenants): fictional-fixture vision benchmark script"`. Running it against the paid API is a human-run gate (G4).

---

### Task 9: Verification, gates, docs

- [ ] **Step 1:** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`.
- [ ] **Step 2:** Create `verification.md` (frontmatter `type: Change Verification`) with: Local results; UI decisions; Privacy checks (no image/PII in logs, storage, audit, quota rows, `localStorage`; `no-store` header); Gate table G1–G5 from the design with owner and status; Cloud gates (migration applied, verification script output, runtime secrets set, flag still off in production); Benchmark summary link.
- [ ] **Step 3:** Create `privacy-review.md` skeleton (frontmatter `type: Change Review`, status draft) listing the questions from Tenant V2 §D6 for the owner and legal reviewer to answer. Do not fill answers.
- [ ] **Step 4:** Update `index.md` status → `implementation-review`; commit `git commit -m "docs(changes): PR5 verification skeleton and privacy review checklist"`.
- [ ] **Step 5:** Enabling `NUXT_AI_TENANT_VISION_ENABLED=true` in any environment that handles real identity documents requires G1–G5 marked passed in `verification.md`. On acceptance update the listed capabilities and archive.
