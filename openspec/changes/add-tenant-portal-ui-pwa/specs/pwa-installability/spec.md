## ADDED Requirements

### Requirement: Single-app installable PWA
The app SHALL be installable as a single Progressive Web App for the whole product on one domain, using `@vite-pwa/nuxt` with a valid manifest (name, short_name, lang, `display: standalone`, theme/background colors, and 192/512 icons including a maskable icon) and `registerType: autoUpdate`. Installing once SHALL be followed by role-based redirect via `getRedirectByRole`.

#### Scenario: App is installable
- **WHEN** a supported browser loads the app
- **THEN** a valid manifest and service worker enable installation

#### Scenario: Service worker auto-updates
- **WHEN** a new deployment is available
- **THEN** the service worker updates automatically per `autoUpdate`

#### Scenario: Install once, redirect by role
- **WHEN** an installed user opens the app and authenticates
- **THEN** `getRedirectByRole` routes them to `/portal` or `/dashboard`

---

### Requirement: Cache excludes authenticated personal data
The PWA runtime cache SHALL precache static assets only and SHALL NOT cache authenticated personal-data API responses. There SHALL be no blanket runtime caching of `*.supabase.co` or `/api/tenant/**`; invoice, profile, contract, and document payloads SHALL never be written to the cache.

#### Scenario: Static assets precached
- **WHEN** the service worker installs
- **THEN** it precaches static assets (js/css/html/images) only

#### Scenario: Personal data not cached
- **WHEN** a tenant fetches invoices, profile, contract, or documents
- **THEN** the response is not written to any service-worker cache

#### Scenario: Navigation fallback is non-sensitive
- **WHEN** an offline navigation fallback is served
- **THEN** it does not serve authenticated personal data
