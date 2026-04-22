## ADDED Requirements

### Requirement: i18n is configured with Vietnamese as default and English as secondary locale
The system SHALL support `vi` (Vietnamese, default) and `en` (English) using the `prefix_except_default` routing strategy with lazy-loaded locale files.

#### Scenario: Default locale routes have no prefix
- **WHEN** a user navigates to `/dashboard`
- **THEN** the page renders in Vietnamese without redirecting to `/vi/dashboard`

#### Scenario: English locale uses /en prefix
- **WHEN** a user navigates to `/en/dashboard`
- **THEN** the page renders in English

#### Scenario: Locale files are lazy-loaded
- **WHEN** a user visits the first page in Vietnamese
- **THEN** only the Vietnamese locale chunks relevant to that route are fetched

### Requirement: Locale files are split by feature domain
The system SHALL organize translation keys into domain-specific JSON files: `common.json`, `auth.json`, `buildings.json`, `rooms.json`, `tenants.json`, `contracts.json`, `invoices.json`, `utilities.json` — for both `vi/` and `en/` locales.

#### Scenario: common.json contains navigation and action keys
- **WHEN** a component uses `$t('common.actions.save')`
- **THEN** the correct localized string is returned in the active locale

#### Scenario: Missing translation key falls back gracefully
- **WHEN** a translation key exists in `vi/` but not in `en/`
- **THEN** the system renders the Vietnamese fallback value instead of the raw key

### Requirement: common.json covers shared UI strings
The system SHALL define translation keys in `common.json` for: navigation labels, CRUD action labels (save, cancel, delete, edit, create, confirm), status labels (active, inactive, pending, expired), validation messages (required, min length, max length, invalid format), and date/currency format tokens.

#### Scenario: Action labels are translated
- **WHEN** a component renders a save button using `$t('common.actions.save')`
- **THEN** the button label shows "Lưu" in Vietnamese and "Save" in English

#### Scenario: Validation messages are translated
- **WHEN** a form field fails required validation
- **THEN** the error message shows the localized required-field message

### Requirement: useLocale() composable provides language switching and formatting utilities
The system SHALL expose a `useLocale()` composable with methods: `switchLocale(locale)`, `formatCurrency(amount, currency?)`, `formatDate(date, format?)`.

#### Scenario: Language can be switched programmatically
- **WHEN** `switchLocale('en')` is called
- **THEN** the active locale switches to English and all `$t()` calls return English strings

#### Scenario: Currency is formatted per locale
- **WHEN** `formatCurrency(1500000)` is called in Vietnamese locale
- **THEN** the output is formatted as Vietnamese Dong (e.g., "1.500.000 ₫")

#### Scenario: Date is formatted per locale
- **WHEN** `formatDate(new Date('2024-01-15'))` is called in Vietnamese locale
- **THEN** the output follows Vietnamese date convention (e.g., "15/01/2024")
