## 1. Database and Contracts

- [x] 1.1 Add failing SQL verification for private pending-request storage, trigger behavior, constraints, and RLS grants
- [x] 1.2 Add the `access_requests` migration and regenerate database types through the configured Supabase workflow
- [x] 1.3 Add access-request DTOs, Zod validators, capability, audit actions, and API namespace contract tests

## 2. Server Approval Workflow

- [x] 2.1 Add failing repository and service tests for self lookup, listing, validation, approval, rejection, concurrency, and compensation
- [x] 2.2 Implement the access-request repository, Auth user inspection/update helpers, approval service, and audit integration
- [x] 2.3 Add authenticated self-status and admin list/approve/reject API handlers with endpoint tests

## 3. Auth Lifecycle and Routing

- [x] 3.1 Add failing redirect, middleware, callback, and auth composable tests for missing-role, registration, recovery, and session refresh
- [x] 3.2 Implement the auth namespace, redirect/middleware rules, and expanded `useAuth` lifecycle
- [x] 3.3 Implement and test register, forgot-password, reset-password, callback, and pending-status pages

## 4. Admin Review UI

- [x] 4.1 Add failing tests for admin-only navigation, queue states, role-dependent approval validation, and rejection
- [x] 4.2 Implement access-request list composable, admin settings page, approval modal, filters, and responsive states with existing primitives

## 5. Auth Redesign and Polish

- [x] 5.1 Add the Zeno operational auth illustration and redesign the shared auth layout within existing dark/cyan/Inter tokens
- [x] 5.2 Redesign login and all auth forms, including accessible password visibility and complete interaction states
- [x] 5.3 Run focused Hallmark critique and inspect desktop plus 320/375/414/768 responsive states with reduced motion

## 6. Specs, Documentation, and Verification

- [x] 6.1 Sync approved delta requirements into main specs without archiving the change
- [x] 6.2 Update auth, frontend, database, API inventory, design-system, and feature documentation
- [x] 6.3 Run OpenSpec validation, SQL verification, narrow suites, typecheck, full tests, lint, and final diff/spec review
