---
applyTo: "app/**/*.ts, app/**/*.vue, server/**/*.ts"
---

# Supabase

Client-side Supabase **chỉ dùng cho auth**. Business data luôn đi qua `server/api/`.

## Rule cứng

```
Client (browser)
  ├── useSupabaseUser()       ← reactive current user ✓
  ├── useSupabaseClient()     ← auth operations only ✓
  └── supabase.from(...)      ← KHÔNG được gọi business data ✗

Server (server/api, server/services, server/repositories)
  ├── serverSupabaseClient(event)      ← data queries ✓
  └── serverSupabaseServiceRole(event) ← bypass RLS khi cần ✓
```

## Biến môi trường Supabase

| Biến | Dùng ở | Được module đọc tự động |
|------|--------|------------------------|
| `SUPABASE_URL` | `@nuxtjs/supabase` | ✓ auto |
| `SUPABASE_KEY` | `@nuxtjs/supabase` | ✓ auto (anon key) |
| `SUPABASE_SECRET_KEY` | server only (bypass RLS) | ✗ dùng thủ công |
| `SUPABASE_PROJECT_REF` | `supabase gen types` CLI | ✗ chỉ CLI |

## Security model

### Public — được phép expose

| Thứ | Lý do |
|---|---|
| `SUPABASE_URL` (project URL) | Public by design — như Firebase project ID |
| `SUPABASE_KEY` (anon key) | Dùng trong browser, Supabase tự document là safe |
| Auth endpoint trong Network tab | Mọi browser auth đều visible — bình thường |

Bảo mật thật sự dựa vào **RLS policies** và **server-side permission checks**, không phải ẩn URL hay key.

### Secret — KHÔNG BAO GIỜ expose

**`SUPABASE_SECRET_KEY` (service role key):**
- Chỉ dùng trong `server/` qua `serverSupabaseServiceRole(event)`
- Bypass toàn bộ RLS — nếu lộ ra client là lỗ hổng nghiêm trọng
- Không bao giờ import trong `app/`
- Không bao giờ trả về trong API response body
- Không bao giờ log ra console

```ts
// ✗ Tuyệt đối không làm
// app/composables/anything.ts
const client = createClient(url, process.env.SUPABASE_SECRET_KEY)

// ✗ Không trả key qua API
// server/api/debug.get.ts
return { key: useRuntimeConfig().supabaseSecretKey }

// ✓ Đúng — chỉ dùng trong server handler
// server/repositories/admin.ts
const admin = await serverSupabaseServiceRole(event)
```

### Checklist bảo mật Supabase

- [ ] `SUPABASE_SECRET_KEY` chỉ có trong `.env`, không bao giờ hardcode
- [ ] `.env` nằm trong `.gitignore`
- [ ] Mọi bảng data có `ENABLE ROW LEVEL SECURITY`
- [ ] Client không gọi `supabase.from(...)` trực tiếp cho business data
- [ ] `app_metadata` chỉ được set qua service role (server), không phải user

## ✓ Cách dùng đúng

**Client — auth composable:**
```ts
// app/composables/auth/useAuth.ts
export function useAuth() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const isAuthenticated = computed(() => user.value !== null)

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${useRuntimeConfig().public.siteUrl}/auth/reset-password`,
    })
    if (error) throw error
  }

  return { user, isAuthenticated, signIn, signOut, resetPassword }
}
```

**Client — type Supabase client với Database:**
```ts
import type { Database } from '~/types/database.types'

// Typed client — autocomplete cho table names và column shapes
const client = useSupabaseClient<Database>()
```

**Server — repository dùng serverSupabaseClient:**
```ts
// server/repositories/buildings.ts
import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'

export const BuildingRepository = {
  async findById(event: H3Event, id: string) {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('*')
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        data: { error: { code: 'NOT_FOUND', message: 'Không tìm thấy tòa nhà' } },
      })
    }
    if (error) throw createError({ statusCode: 500, message: error.message })

    return mapBuilding(data)
  },
}
```

**Server — dùng service role chỉ khi cần bypass RLS:**
```ts
// server/utils/admin.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

// Chỉ dùng cho admin operations: seed, migration, cross-user queries
export async function getAdminClient(event: H3Event) {
  return serverSupabaseServiceRole(event)
}
```

**Server — lấy current user để check auth:**
```ts
// server/utils/auth.ts
import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  return user
}
```

**Supabase config trong nuxt.config.ts:**
```ts
// nuxt.config.ts — đã configured
supabase: {
  redirect: false,  // tự xử lý redirect trong auth middleware của Nuxt
}
```

## ✗ Cách không được dùng

```ts
// ✗ Đừng gọi business data trực tiếp từ client
// app/composables/buildings/useBuildingList.ts
const supabase = useSupabaseClient()
const { data } = await supabase.from('buildings').select('*')
// → Dùng: $fetch('/api/buildings')

// ✗ Đừng dùng service role thay thế cho RLS
// Service role bypass tất cả RLS policy — chỉ dùng khi thật sự cần
const admin = await serverSupabaseServiceRole(event)
const { data } = await admin.from('buildings').select('*') // ← tránh dùng mặc định

// ✗ Đừng bỏ qua kiểm tra error từ Supabase
const { data } = await client.from('buildings').select('*').single()
return mapBuilding(data) // data có thể null nếu có error

// ✗ Đừng lưu session token thủ công — module tự manage
localStorage.setItem('access_token', session.access_token)

// ✗ Đừng dùng untyped client nếu có thể type được
const client = useSupabaseClient()           // ✗ untyped
const client = useSupabaseClient<Database>() // ✓ typed
```

## Supabase SQL Files

**Quy tắc:** Mọi thay đổi liên quan đến Supabase data (tạo bảng, RLS, seed, admin setup) đều phải có file `.sql` tương ứng trong `supabase/` để chạy qua Supabase SQL Editor. File phải an toàn trước khi apply.

### Folder structure

```
supabase/
├── migrations/    ← schema changes: CREATE TABLE, ALTER, RLS policies, functions
└── seeds/         ← initial data, admin setup, one-time scripts
```

### Naming convention

```
migrations/  YYYYMMDD_<kebab-case-description>.sql
seeds/       <kebab-case-description>.sql
```

Ví dụ:
```
supabase/migrations/20260514_create_buildings.sql
supabase/migrations/20260514_buildings_rls.sql
supabase/seeds/set_admin_role.sql
```

### Migration template (CREATE TABLE + RLS)

Mọi migration phải:
- Bọc trong `BEGIN / COMMIT` — nếu có lỗi, tự động rollback toàn bộ
- `REVOKE ALL FROM public` trước khi `GRANT` cụ thể — deny-by-default
- `ENABLE ROW LEVEL SECURITY` ngay sau khi tạo bảng — không có RLS = mọi người đọc được
- Policy dùng `auth.uid()` hoặc `auth.jwt()` — không được dùng `USING (true)` cho bảng chứa data thật

```sql
-- =============================================================================
-- Migration: <description>
-- Date: YYYY-MM-DD
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

BEGIN;

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.<table_name> (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- <columns>
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Lock down access — deny public by default
REVOKE ALL ON TABLE public.<table_name> FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table_name> TO authenticated;

-- 3. Enable RLS — REQUIRED, không có RLS = lỗ hổng nghiêm trọng
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies — dùng auth.uid() hoặc auth.jwt(), KHÔNG dùng USING (true)
--
--   Pattern A: user chỉ thấy data của mình
CREATE POLICY "<table_name>: owner read"
  ON public.<table_name> FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

--   Pattern B: admin thấy tất cả (role từ app_metadata)
CREATE POLICY "<table_name>: admin read all"
  ON public.<table_name> FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

--   Pattern C: bảng shared (buildings, rooms) — authenticated user đọc được
--   Dùng khi data không phải user-private nhưng vẫn cần đăng nhập
CREATE POLICY "<table_name>: authenticated read"
  ON public.<table_name> FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- 5. updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER  -- INVOKER, không phải DEFINER, để chạy với quyền caller
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_<table_name>_updated_at
  BEFORE UPDATE ON public.<table_name>
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- Verify (chạy sau COMMIT)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = '<table_name>';
```

### Seed template

Seed phải:
- Bọc trong `BEGIN / COMMIT`
- Kiểm tra tồn tại trước khi INSERT / UPDATE
- Không hardcode password hay secret

```sql
-- =============================================================================
-- Seed: <description>
-- Date: YYYY-MM-DD
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

BEGIN;

-- Guard: chỉ chạy nếu điều kiện thoả
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ... WHERE ...) THEN
    -- insert / update logic
  END IF;
END;
$$;

COMMIT;

-- Verify
SELECT ...;
```

### Security checklist — bắt buộc trước khi apply

- [ ] Wrapped trong `BEGIN / COMMIT`
- [ ] `REVOKE ALL FROM public, anon` trước `GRANT`
- [ ] `ENABLE ROW LEVEL SECURITY` cho mọi bảng data
- [ ] Policy dùng `auth.uid()` hoặc `auth.jwt()` — không có `USING (true)` cho data thật
- [ ] Function dùng `SECURITY INVOKER` (không phải `DEFINER`) trừ khi có lý do rõ ràng
- [ ] Không có dynamic SQL với string concatenation (`EXECUTE 'SELECT ' || user_input`)
- [ ] Không hardcode secret, token, hay password trong file
- [ ] Có `SELECT` verify cuối file

### ✗ Anti-patterns

```sql
-- ✗ Không có RLS = mọi authenticated user đọc được toàn bộ bảng
CREATE TABLE public.invoices (...);
-- phải thêm: ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ✗ USING (true) trên bảng data thật = bypass access control
CREATE POLICY "read all" ON public.invoices FOR SELECT USING (true);

-- ✗ SECURITY DEFINER không cần thiết = function chạy với quyền owner, rất nguy hiểm
CREATE FUNCTION get_all_users() RETURNS ... SECURITY DEFINER ...;

-- ✗ Dynamic SQL với input không sanitize = SQL injection
EXECUTE 'SELECT * FROM ' || table_name;

-- ✗ Grant quá rộng
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
```

### Khi nào tạo file nào

| Hành động | Folder | Ví dụ |
|---|---|---|
| Tạo bảng mới | `migrations/` | `20260601_create_rooms.sql` |
| Thêm column / index | `migrations/` | `20260601_rooms_add_floor.sql` |
| Thêm / sửa RLS policy | `migrations/` | `20260601_rooms_rls.sql` |
| Tạo DB function / trigger | `migrations/` | `20260601_updated_at_trigger.sql` |
| Set app_metadata / role | `seeds/` | `set_admin_role.sql` |
| Seed dữ liệu mẫu | `seeds/` | `seed_buildings.sql` |

### Workflow

1. Tạo `.sql` file cùng lúc với code feature (trong cùng task group)
2. Tự review theo Security checklist ở trên trước khi apply
3. Chạy trong **Supabase Dashboard → SQL Editor** (dev project trước)
4. Verify kết quả bằng `SELECT` cuối file
5. Apply lên staging/prod theo thứ tự file name (migrations theo ngày)
