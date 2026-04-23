## MODIFIED Requirements

### Requirement: instructions/ directory exists with 7 coding convention files
The system SHALL have an `instructions/` directory at the project root containing 8 markdown files covering coding conventions for Claude Code and team members.

#### Scenario: All required instruction files exist
- **WHEN** a developer checks out the repository
- **THEN** `instructions/project-structure.md`, `instructions/typescript.md`, `instructions/supabase-platform.md`, `instructions/api-conventions.md`, `instructions/components.md`, `instructions/composables.md`, `instructions/stores.md`, `instructions/styling.md`, `instructions/svg.md` all exist
