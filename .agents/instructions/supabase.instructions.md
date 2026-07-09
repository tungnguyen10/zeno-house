---
applyTo: "app/composables/**/*.ts, app/stores/**/*.ts, app/middleware/**/*.ts, app/types/database.types.ts, server/**/*.ts, supabase/**/*.sql, nuxt.config.ts"
---

# Supabase

Client-side Supabase is for **auth only**. Business data must always go through `server/api/`.

## Hard Rules

```
Client (browser)
  ├── useSupabaseUser()       ← reactive current user ✓
  ├── useSupabaseClient()     ← auth operations only ✓
  └── supabase.from(...)      ← KHÔNG được gọi business data ✗

Server (server/api, server/services, server/repositories)
  ├── serverSupabaseClient(event)      ← data queries ✓
  └── serverSupabaseServiceRole(event) ← bypass RLS khi cần ✓
```

## Supabase Environment Variables

| Variable | Used by | Auto-loaded by module |
|------|--------|------------------------|
| `SUPABASE_URL` | `@nuxtjs/supabase` | ✓ auto |
| `SUPABASE_KEY` | `@nuxtjs/supabase` | ✓ auto (anon key) |
| `SUPABASE_SECRET_KEY` | server only (bypass RLS) | ✗ manual |
| `SUPABASE_PROJECT_REF` | `supabase gen types` CLI | ✗ CLI only |

## Security Model

### Public — safe to expose

| Item | Reason |
|---|---|
| `SUPABASE_URL` (project URL) | Public by design — same as Firebase project ID |
| `SUPABASE_KEY` (anon key) | Used in browser, Supabase documents it as safe |
| Auth endpoint in Network tab | All browser auth is visible — expected behaviour |

Real security comes from **RLS policies** and **server-side permission checks**, not from hiding the URL or key.

### Secret — NEVER expose

**`SUPABASE_SECRET_KEY` (service role key):**
- Use only in `server/` via `serverSupabaseServiceRole(event)`
- Bypasses all RLS — leaking to client is a critical vulnerability
- Never import in `app/`
- Never return in API response body
- Never log to console

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

### Supabase Security Checklist

- [ ] `SUPABASE_SECRET_KEY` only in `.env`, never hardcoded
- [ ] `.env` listed in `.gitignore`
- [ ] Every data table has `ENABLE ROW LEVEL SECURITY`
- [ ] Client does not call `supabase.from(...)` directly for business data
- [ ] `app_metadata` only set via service role (server), not by the user

## ✓ Correct Usage

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

**Client — type Supabase client with Database:**
```ts
import type { Database } from '~/types/database.types'

// Typed client — autocomplete cho table names và column shapes
const client = useSupabaseClient<Database>()
```

**Server — repository using serverSupabaseClient:**
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
    if (error) throwDbError(error, 'buildings.findById')

    return mapBuilding(data)
  },
}
```

**Server — use service role only when bypassing RLS:**
```ts
// server/utils/admin.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

// Chỉ dùng cho admin operations: seed, migration, cross-user queries
export async function getAdminClient(event: H3Event) {
  return serverSupabaseServiceRole(event)
}
```

**Server — get current user for auth check:**
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

**Supabase config in nuxt.config.ts:**
```ts
// nuxt.config.ts — đã configured
supabase: {
  redirect: false,  // tự xử lý redirect trong auth middleware của Nuxt
}
```

## ✗ Do Not

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

**Rule:** Every change related to Supabase data (table creation, RLS, seeds, admin setup) must have a corresponding `.sql` file under `supabase/` to run via the Supabase SQL Editor. The file must be reviewed before applying.

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

Examples:
```
supabase/migrations/20260514_create_buildings.sql
supabase/migrations/20260514_buildings_rls.sql
supabase/seeds/set_admin_role.sql
```

### Migration Template (CREATE TABLE + RLS)

Every migration must:
- Wrap in `BEGIN / COMMIT` — rolls back automatically on error
- `REVOKE ALL FROM public` before explicit `GRANT` — deny-by-default
- `ENABLE ROW LEVEL SECURITY` immediately after table creation — no RLS means everyone can read
- Policies must use `auth.uid()` or `auth.jwt()` — never `USING (true)` for tables with real data

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

### Seed Template

Seeds must:
- Wrap in `BEGIN / COMMIT`
- Check for existence before INSERT / UPDATE
- Never hardcode passwords or secrets

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

### Security Checklist — required before applying

- [ ] Wrapped in `BEGIN / COMMIT`
- [ ] `REVOKE ALL FROM public, anon` before `GRANT`
- [ ] `ENABLE ROW LEVEL SECURITY` on every data table
- [ ] Policies use `auth.uid()` or `auth.jwt()` — no `USING (true)` for real data
- [ ] Functions use `SECURITY INVOKER` (not `DEFINER`) unless there is a clear reason
- [ ] No dynamic SQL with string concatenation (`EXECUTE 'SELECT ' || user_input`)
- [ ] No hardcoded secrets, tokens, or passwords in the file
- [ ] `SELECT` verify statement at the end of the file

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

### When to create which file

| Action | Folder | Example |
|---|---|---|
| Create new table | `migrations/` | `20260601_create_rooms.sql` |
| Add column / index | `migrations/` | `20260601_rooms_add_floor.sql` |
| Add / update RLS policy | `migrations/` | `20260601_rooms_rls.sql` |
| Create DB function / trigger | `migrations/` | `20260601_updated_at_trigger.sql` |
| Set app_metadata / role | `seeds/` | `set_admin_role.sql` |
| Seed sample data | `seeds/` | `seed_buildings.sql` |

### Workflow

1. Create the `.sql` file alongside the code feature (in the same task group)
2. Self-review against the Security Checklist above before applying
3. Run in **Supabase Dashboard → SQL Editor** (dev project first)
4. Verify results using the `SELECT` at the end of the file
5. Apply to staging/prod in file name order (migrations by date)
