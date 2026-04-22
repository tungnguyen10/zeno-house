## ADDED Requirements

### Requirement: CI pipeline runs on every pull request
The system SHALL have a GitHub Actions workflow that runs on every PR targeting `main`, executing: ESLint lint check, TypeScript type check, and Nuxt build test.

#### Scenario: CI blocks merge on lint failure
- **WHEN** a PR contains a file with lint errors
- **THEN** the lint CI job fails and the PR cannot be merged until fixed

#### Scenario: CI blocks merge on type errors
- **WHEN** a PR contains a TypeScript type error
- **THEN** the type-check CI job fails and the PR cannot be merged until fixed

#### Scenario: CI blocks merge on build failure
- **WHEN** a PR contains code that breaks the Nuxt build
- **THEN** the build CI job fails and the PR cannot be merged until fixed

### Requirement: Lighthouse CI enforces performance thresholds on PRs
The system SHALL run Lighthouse CI against Vercel preview deployments on every PR, with minimum thresholds: Performance ≥ 80, Accessibility ≥ 80, Best Practices ≥ 80, SEO ≥ 80.

#### Scenario: Lighthouse CI passes when thresholds are met
- **WHEN** all Lighthouse scores meet or exceed 80
- **THEN** the Lighthouse CI check passes and the PR can proceed to merge

#### Scenario: Lighthouse CI fails when a threshold is missed
- **WHEN** the Performance score drops below 80
- **THEN** the Lighthouse CI check fails with a report showing which score failed

### Requirement: Vercel auto-deploys on merge to main
The system SHALL automatically deploy to Vercel production when a PR is merged to `main`.

#### Scenario: Production deploy triggers on merge
- **WHEN** a PR is merged to `main`
- **THEN** Vercel receives a deploy webhook and builds the production deployment

#### Scenario: Preview deploy is created for each PR
- **WHEN** a PR is opened or updated
- **THEN** Vercel creates a unique preview URL for that PR

### Requirement: CI environment variables are documented
The system SHALL document all required GitHub Actions secrets in the repository README or a CI setup guide: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `LHCI_GITHUB_APP_TOKEN`.

#### Scenario: CI runs with all secrets configured
- **WHEN** all required secrets are set in the GitHub repository settings
- **THEN** all CI jobs complete without authentication or configuration errors

#### Scenario: Missing secret causes clear failure
- **WHEN** a required secret is missing
- **THEN** the CI job fails with a message indicating which secret is missing
