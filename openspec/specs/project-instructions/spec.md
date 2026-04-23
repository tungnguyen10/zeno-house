## Purpose

Defines requirements for the `instructions/` directory — a set of coding convention files that guide Claude Code and team members when developing the zeno-house project.

## Requirements

### Requirement: instructions/ directory exists with 7 coding convention files
The system SHALL have an `instructions/` directory at the project root containing 8 markdown files covering coding conventions for Claude Code and team members.

#### Scenario: All required instruction files exist
- **WHEN** a developer checks out the repository
- **THEN** `instructions/project-structure.md`, `instructions/typescript.md`, `instructions/supabase-platform.md`, `instructions/api-conventions.md`, `instructions/components.md`, `instructions/composables.md`, `instructions/stores.md`, `instructions/styling.md`, `instructions/svg.md` all exist

### Requirement: Each instruction file contains actionable rules with anti-patterns
The system SHALL have each instruction file contain: a brief purpose statement, explicit DO rules with examples, and explicit anti-pattern (DON'T) rules that prevent common mistakes.

#### Scenario: Instruction file prevents Supabase direct call from component
- **WHEN** Claude Code reads `instructions/supabase-platform.md`
- **THEN** the file explicitly states that components MUST NOT call Supabase directly and MUST use `server/api/` routes instead

#### Scenario: Instruction file enforces Zod validation at server boundary
- **WHEN** Claude Code reads `instructions/api-conventions.md`
- **THEN** the file states that all `server/api/` handlers MUST validate request body with Zod before processing

### Requirement: CLAUDE.md is refactored as a thin index with @imports
The system SHALL have `CLAUDE.md` restructured as a thin index that uses `@file` imports to load instruction files, rather than containing lengthy inline content.

#### Scenario: CLAUDE.md loads instruction files via @imports
- **WHEN** Claude Code reads `CLAUDE.md`
- **THEN** the file contains `@instructions/<file>.md` import lines for each instruction file

#### Scenario: CLAUDE.md retains stack overview and role matrix
- **WHEN** a new developer opens `CLAUDE.md`
- **THEN** they can still see: stack, 3 roles (Admin/Manager/Tenant), and critical notes without opening sub-files

### Requirement: CLAUDE.md correctly identifies project as Nuxt 4
The system SHALL have `CLAUDE.md` state "Nuxt 4" (not "Nuxt 3") to match the actual installed version (`nuxt@^4.4.2`) and `app/` directory structure.

#### Scenario: Nuxt version is accurate
- **WHEN** Claude Code reads `CLAUDE.md`
- **THEN** the stack section states "Nuxt 4" with a note about the `app/` directory convention

### Requirement: project-structure.md documents Nuxt 4 app/ layout
The system SHALL have `instructions/project-structure.md` document the actual Nuxt 4 directory structure with `app/` as the source directory for all client-side code.

#### Scenario: File placement rules are unambiguous
- **WHEN** a developer needs to add a new component
- **THEN** `project-structure.md` clearly states: `app/components/` for all Vue components, with naming conventions

### Requirement: supabase-platform.md documents two Supabase client modes
The system SHALL have `instructions/supabase-platform.md` document the distinction between the service-role client (server-side privileged ops) and the user-scoped client (user JWT via @nuxtjs/supabase SSR).

#### Scenario: Developer knows which client to use in server routes
- **WHEN** Claude Code reads `supabase-platform.md`
- **THEN** it can determine: use service-role client for admin mutations, use user-scoped client for RLS-protected reads

### Requirement: api-conventions.md documents server/api/ REST patterns
The system SHALL have `instructions/api-conventions.md` document naming conventions, HTTP methods, response shapes, error codes, and Zod validation patterns for all `server/api/` routes.

#### Scenario: Error response shape is consistent
- **WHEN** Claude Code reads `api-conventions.md`
- **THEN** the file specifies the exact error response format: `{ error: string, statusCode: number }`
