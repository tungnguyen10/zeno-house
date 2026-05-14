## ADDED Requirements

### Requirement: Auth store chứa session state
`stores/auth.ts` SHALL expose reactive session state dựa trên `useSupabaseUser()`. Store SHALL cung cấp `user`, `isAuthenticated`, `role`, và `isAdmin` getters.

#### Scenario: State khi đã đăng nhập
- **WHEN** Supabase session tồn tại
- **THEN** `isAuthenticated` là `true`, `user` chứa Supabase user object, `role` lấy từ `user.app_metadata.role`

#### Scenario: State khi chưa đăng nhập
- **WHEN** không có Supabase session
- **THEN** `isAuthenticated` là `false`, `user` là `null`, `role` là `null`

#### Scenario: `isAdmin` getter
- **WHEN** `role` là `'admin'`
- **THEN** `isAdmin` trả về `true`

#### Scenario: Role thiếu trong app_metadata
- **WHEN** user đã login nhưng `app_metadata.role` chưa được set
- **THEN** `role` là `null`, user vẫn có thể login (không bị block), nhưng không có quyền admin

---

### Requirement: `useAuth()` composable là entry point cho auth actions
`composables/auth/useAuth.ts` SHALL export các action: `login(email, password)`, `logout()`. Components và pages SHALL dùng `useAuth()` thay vì gọi Supabase trực tiếp.

#### Scenario: `login()` gọi Supabase signInWithPassword
- **WHEN** `login(email, password)` được gọi
- **THEN** composable gọi `supabase.auth.signInWithPassword({ email, password })` và trả về result

#### Scenario: `logout()` gọi Supabase signOut
- **WHEN** `logout()` được gọi
- **THEN** composable gọi `supabase.auth.signOut()` và navigate về `/login`
