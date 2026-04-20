## ADDED Requirements

### Requirement: Nuxt 3 project is initialized with required dependencies
The system SHALL have a runnable Nuxt 3 project with TypeScript strict mode and all required packages installed: `@nuxt/ui`, `@nuxtjs/supabase`, `@nuxtjs/i18n`, `@pinia/nuxt`, `@vueuse/nuxt`, `zod`, `date-fns`.

#### Scenario: Dev server starts
- **WHEN** developer runs `pnpm dev`
- **THEN** Nuxt dev server starts without errors on localhost:3000

#### Scenario: Type check passes
- **WHEN** developer runs `pnpm typecheck`
- **THEN** TypeScript compiler reports zero errors with strict mode enabled

### Requirement: nuxt.config.ts is fully configured
The system SHALL have `nuxt.config.ts` configured with all modules, Supabase settings, i18n config, runtime config, and app head with `lang="vi"`.

#### Scenario: Modules are registered
- **WHEN** Nuxt builds the application
- **THEN** all modules (`@nuxt/ui`, `@nuxtjs/supabase`, `@nuxtjs/i18n`, `@pinia/nuxt`, `@vueuse/nuxt`) are loaded without warnings

#### Scenario: Runtime config exposes public keys
- **WHEN** client code accesses `useRuntimeConfig().public`
- **THEN** `supabaseUrl` and `supabaseKey` are available as public runtime config

### Requirement: TailwindCSS is configured with custom room-status colors
The system SHALL extend the Tailwind theme with semantic color tokens for room statuses: `available`, `occupied`, `maintenance`, `reserved`.

#### Scenario: Room status color tokens are available
- **WHEN** a component uses `bg-room-available` or `text-room-occupied`
- **THEN** TailwindCSS applies the correct custom color without purging it

### Requirement: ESLint and Prettier are configured
The system SHALL enforce code style with ESLint (Vue 3 + TypeScript rules) and Prettier formatting.

#### Scenario: Lint passes on clean code
- **WHEN** developer runs `pnpm lint`
- **THEN** no lint errors are reported on the scaffolded project files

#### Scenario: Lint fails on rule violations
- **WHEN** a file contains an unused variable or missing semicolon (per config)
- **THEN** `pnpm lint` exits with a non-zero code

### Requirement: Project directory structure matches the target architecture
The system SHALL have the directory structure defined in CLAUDE.md: `components/`, `composables/`, `layouts/`, `middleware/`, `pages/admin/`, `pages/manager/`, `pages/tenant/`, `server/api/`, `server/utils/`, `stores/`, `types/`, `supabase/migrations/`.

#### Scenario: Directory structure exists
- **WHEN** developer clones the repository and installs dependencies
- **THEN** all required directories exist and contain at least a `.gitkeep` placeholder

### Requirement: .env.example documents all required environment variables
The system SHALL include a `.env.example` file listing all required environment variables with descriptions.

#### Scenario: .env.example is complete
- **WHEN** a new developer reviews `.env.example`
- **THEN** all variables needed to run the app locally are listed with example values or descriptions
