## ADDED Requirements

### Requirement: Auth i18n keys exist in vi and en locales
The system SHALL have `locales/vi/auth.json` and `locales/en/auth.json` containing all translation keys used by login pages, forgot-password page, and auth-related error messages. No auth string is hardcoded in templates.

#### Scenario: Login form uses i18n keys
- **WHEN** a developer inspects `app/pages/login.vue` or `app/pages/tenant/login.vue`
- **THEN** all visible text uses `$t('auth.*')` keys — no hardcoded Vietnamese or English strings

#### Scenario: Auth error messages are translated
- **WHEN** a login fails
- **THEN** the error message shown is loaded from `auth.errors.*` i18n keys

#### Scenario: Both locales have identical key sets
- **WHEN** a key exists in `locales/vi/auth.json`
- **THEN** the same key exists in `locales/en/auth.json` (no missing translations)
