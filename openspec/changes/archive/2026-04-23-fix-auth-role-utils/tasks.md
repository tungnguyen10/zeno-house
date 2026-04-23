## 1. Remove Dead Code

- [x] 1.1 Delete the `requireSuperAdmin` function from `server/utils/supabase.ts` (file becomes comments-only or empty)

## 2. Add requireRole Utility

- [x] 2.1 Create `server/utils/requireRole.ts` with `requireRole(event: H3Event, ...roles: Role[])` signature
- [x] 2.2 Implement: call `serverSupabaseUser(event)` → throw 401 if null
- [x] 2.3 Implement: call `serverSupabaseServiceRole(event)` → query `profiles.role` by user ID → throw 403 if role not in allowed set
- [x] 2.4 Return `{ user, role }` on success with correct TypeScript types (import `Role` from `~/types`)

## 3. Fix index.vue Redirect

- [x] 3.1 Update `app/pages/index.vue` to add authenticated branch: if user exists → `fetchRole()` from `useAuthStore` → `navigateTo('/admin' | '/manager' | '/tenant')`
