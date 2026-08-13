# pwa-installability Specification

## Purpose
TBD - created by archiving change add-tenant-portal-ui-pwa. Update Purpose after archive.
## Requirements
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

### Requirement: Install prompt and iOS support
The app SHALL present one app-scoped, custom, dismissible install prompt driven by `beforeinstallprompt` on supporting platforms, and SHALL NOT show it on first paint or when already running in `display-mode: standalone`. The prompt SHALL remain available across portal, dashboard, and auth layouts without being owned by a role-specific layout. For iOS and iPadOS, where `beforeinstallprompt` is not fired, the app SHALL recognize both mobile and desktop-class iPad user agents and provide a browser-neutral "Add to Home Screen" instruction sheet. The sheet SHALL cover the current Share → Add to Home Screen → Open as Web App → Add flow and direct users to Safari when their current browser does not expose the action. The app SHALL set `apple-touch-icon`, `apple-mobile-web-app-capable`, a status-bar style, and media-qualified light and dark startup images for supported iPhone and iPad sizes in portrait and landscape. Startup imagery SHALL use the portal canvas colors and Zeno mark so an installed tenant transitions continuously into the portal bootstrap splash, while dashboard and auth layouts SHALL NOT gain an application-managed splash.

#### Scenario: Custom install prompt on supported platforms
- **WHEN** `beforeinstallprompt` fires and the app is not already installed
- **THEN** a custom, dismissible install prompt is offered at an appropriate moment, not on first paint

#### Scenario: iOS add-to-home guidance
- **WHEN** the app runs on iOS Safari
- **THEN** an "Add to Home Screen" instruction sheet is available and iOS icon/splash/status-bar metadata is set

#### Scenario: Desktop-class iPad guidance
- **WHEN** Safari on iPadOS presents a Mac desktop user agent
- **THEN** the app still recognizes the device as Apple mobile and offers the manual install guide

#### Scenario: Install prompt follows the user across roles
- **WHEN** an eligible user visits an auth, dashboard, or portal route
- **THEN** the same app-scoped install host can offer installation without duplicate role-layout mounts

#### Scenario: Apple launch image matches device and appearance
- **WHEN** an installed PWA launches on a supported iPhone or iPad in portrait or landscape with a light or dark system appearance
- **THEN** iOS selects a startup image with matching dimensions, orientation, pixel density, and color scheme

#### Scenario: Tenant launch continues into bootstrap splash
- **WHEN** the native startup image yields to a tenant portal whose bootstrap is still pending or within its minimum brand interval
- **THEN** the portal-scoped splash continues with matching canvas and centered Zeno mark until bootstrap is ready

#### Scenario: No managed splash outside tenant portal
- **WHEN** an authenticated admin, owner, or manager is routed to the dashboard, or a guest opens an auth page
- **THEN** no application-managed portal splash is mounted

#### Scenario: No prompt in standalone
- **WHEN** the app already runs in `display-mode: standalone`
- **THEN** the install prompt is not shown

---

### Requirement: Cache excludes authenticated personal data
The PWA runtime cache SHALL precache static assets only and SHALL NOT cache authenticated personal-data API responses. There SHALL be no blanket runtime caching of `*.supabase.co` or `/api/tenant/**`; invoice, profile, contract, and document payloads, including signed URLs, SHALL never be written to the cache.

#### Scenario: Static assets precached
- **WHEN** the service worker installs
- **THEN** it precaches static assets (js/css/html/images) only

#### Scenario: Personal data not cached
- **WHEN** a tenant fetches invoices, profile, contract, identity images, or documents
- **THEN** the response, including any signed URL, is not written to any service-worker cache

---

### Requirement: Offline shell fallback
The app SHALL provide a minimal, non-sensitive offline fallback (branding + retry) served through an SPA-aware `navigateFallback`, and the fallback SHALL never serve authenticated personal data.

#### Scenario: Offline fallback is non-sensitive
- **WHEN** an offline navigation fallback is served
- **THEN** it shows a minimal branded retry screen and does not serve authenticated personal data
