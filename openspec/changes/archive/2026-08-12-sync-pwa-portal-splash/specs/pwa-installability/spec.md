## MODIFIED Requirements

### Requirement: Install prompt and iOS support
The app SHALL present a custom, dismissible install prompt driven by `beforeinstallprompt` on supporting platforms, and SHALL NOT show it on first paint or when already running in `display-mode: standalone`. For iOS, where `beforeinstallprompt` is not fired, the app SHALL provide an "Add to Home Screen" instruction sheet and SHALL set `apple-touch-icon`, `apple-mobile-web-app-capable`, a status-bar style, and media-qualified light and dark startup images for supported iPhone and iPad sizes in portrait and landscape. Startup imagery SHALL use the portal canvas colors and Zeno mark so an installed tenant transitions continuously into the portal bootstrap splash, while dashboard and auth layouts SHALL NOT gain an application-managed splash.

#### Scenario: Custom install prompt on supported platforms
- **WHEN** `beforeinstallprompt` fires and the app is not already installed
- **THEN** a custom, dismissible install prompt is offered at an appropriate moment, not on first paint

#### Scenario: iOS add-to-home guidance
- **WHEN** the app runs on iOS Safari
- **THEN** an "Add to Home Screen" instruction sheet is available and iOS icon/splash/status-bar metadata is set

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
