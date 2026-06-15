## Purpose
Defines database schema, security, generated types, and persisted identifiers for building records.
## Requirements
### Requirement: Bảng buildings tồn tại trong Supabase
`supabase/migrations/` SHALL chứa SQL file tạo bảng `buildings` với các cột: `id` (uuid, PK), `name` (text, not null), `address` (text, not null), `description` (text, nullable), `status` (text, default 'active'), `total_rooms` (integer, default 0), `created_at`, `updated_at` (timestamptz).

#### Scenario: Migration tạo bảng thành công
- **WHEN** SQL migration được apply lên Supabase
- **THEN** bảng `buildings` tồn tại với đúng columns và constraints

#### Scenario: Default values đúng
- **WHEN** insert row mới không cung cấp `id`, `status`, `total_rooms`, `created_at`, `updated_at`
- **THEN** các fields này có giá trị mặc định: uuid, 'active', 0, now(), now()

---

### Requirement: RLS bảo vệ bảng buildings
Bảng `buildings` SHALL có Row Level Security enabled. Admin SHALL có full access (SELECT, INSERT, UPDATE, DELETE). Manager SHALL chỉ có SELECT. Anonymous SHALL không có quyền gì.

#### Scenario: Admin có full access
- **WHEN** request được thực hiện với JWT có `app_metadata.role = 'admin'`
- **THEN** tất cả CRUD operations đều được phép bởi RLS

#### Scenario: Manager chỉ đọc được
- **WHEN** request được thực hiện với JWT có `app_metadata.role = 'manager'`
- **THEN** SELECT được phép, INSERT/UPDATE/DELETE bị block bởi RLS

#### Scenario: Anonymous bị chặn
- **WHEN** request không có JWT hoặc JWT không có role
- **THEN** mọi operation đều bị RLS block

---

### Requirement: database.types.ts phản ánh schema sau migration
Sau khi apply migration và regenerate types, `database.types.ts` SHALL có `Tables<'buildings'>` với đúng Row, Insert, Update shapes.

#### Scenario: Tables<'buildings'> type available
- **WHEN** developer dùng `Tables<'buildings'>`
- **THEN** TypeScript infer đúng shape với tất cả columns

### Requirement: Buildings have unique slugs
The `buildings` table SHALL include a non-null `slug` column. Existing rows SHALL be backfilled from `name`, and slugs SHALL be unique across buildings.

#### Scenario: Existing buildings receive slugs
- **WHEN** the slug migration is applied
- **THEN** every existing building row has a non-empty slug derived from its name

#### Scenario: Slug uniqueness enforced
- **WHEN** two building names normalize to the same slug
- **THEN** the stored slugs remain unique

#### Scenario: New building receives slug
- **WHEN** a new building is created without an explicit slug
- **THEN** the system stores a unique slug derived from the building name

