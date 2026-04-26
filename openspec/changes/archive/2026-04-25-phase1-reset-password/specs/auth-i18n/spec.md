## MODIFIED Requirements

### Requirement: Auth i18n keys exist in vi and en locales
The system SHALL have `i18n/locales/vi/auth.json` and `i18n/locales/en/auth.json` containing all translation keys used by login pages, forgot-password page, reset-password page, and auth-related error messages. No auth string is hardcoded in templates.

Keys include: `login`, `logout`, `email`, `password`, `forgot_password`, `admin_portal`, `tenant_portal`, `email_placeholder`, `password_placeholder`, `forgot_password_title`, `forgot_password_description`, `send_reset_link`, `reset_sent`, `reset_sent_description`, `back_to_login`, `login_with_google`, `or`, `reset_password_title`, `reset_password_description`, `new_password`, `new_password_placeholder`, `confirm_password`, `confirm_password_placeholder`, `update_password`, `password_updated`, `password_updated_description`, and `errors.invalid_credentials`, `errors.email_required`, `errors.wrong_role`, `errors.password_mismatch`, `errors.password_too_short`, `errors.invalid_reset_link`.

#### Scenario: Login form uses i18n keys
- **WHEN** a developer inspects `app/pages/login.vue` or `app/pages/tenant/login.vue`
- **THEN** all visible text uses `$t('auth.*')` keys — no hardcoded Vietnamese or English strings

#### Scenario: Auth error messages are translated
- **WHEN** a login fails
- **THEN** the error message shown is loaded from `auth.errors.*` i18n keys

#### Scenario: Both locales have identical key sets
- **WHEN** a key exists in `i18n/locales/vi/auth.json`
- **THEN** the same key exists in `i18n/locales/en/auth.json` (no missing translations)

#### Scenario: Reset password page uses i18n keys
- **WHEN** a developer inspects `app/pages/reset-password.vue`
- **THEN** all visible text uses `$t('auth.*')` keys — no hardcoded strings
