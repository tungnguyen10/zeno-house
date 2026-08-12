## Context

The product is installed as one PWA whose `/` start URL redirects by role. Android already derives a launch screen from the manifest, while iOS/iPadOS requires explicit `apple-touch-startup-image` links for device-specific native launch images. The tenant layout then displays `PortalSplash` while its shared bootstrap resolves, so the native image and web splash must share background and mark placement to avoid a visible jump.

The portal supports light and dark appearance, defaults to the system preference, and uses `#f8fafc` and `#0b1624` as its canvas colors. Its animated tracking beam cannot exist in a static operating-system startup image.

## Goals / Non-Goals

**Goals:**

- Reproducibly generate light/dark startup images for supported iPhone and iPad sizes in both orientations.
- Register exact media-qualified startup-image links and preserve the existing manifest icons.
- Make the handoff from native launch UI to the tenant bootstrap splash visually continuous.
- Test timing, accessibility, metadata, file validity, and build integration.

**Non-Goals:**

- Adding splash components to dashboard or auth layouts.
- Changing portal bootstrap ownership, API behavior, routes, DTOs, database schema, or service-worker caching policy.
- Reproducing the animated tracking beam in native images.

## Decisions

1. Add `@vite-pwa/assets-generator` as a development-only dependency and expose a package script. The official generator owns Apple device dimensions and media-query rules; committed output makes deployments independent of runtime generation and reviewable. Hand-maintained PNGs and media queries were rejected because they drift when Apple sizes or the logo change.
2. Use the standalone gold Zeno mark as the generator input because it has no `currentColor` dependency and remains stable outside Vue/CSS. Use `#f8fafc` for light images and `#0b1624` for dark images with centered, contained placement matching the portal splash mark footprint.
3. Generate all supported iPhone/iPad portrait and landscape images, including dark variants selected with `prefers-color-scheme`. The manifest remains portrait-oriented, but complete orientation coverage prevents a stale or blank startup screen when the OS restores an existing orientation.
4. Keep `PortalSplash` portal-scoped and bootstrap-driven. Its 300 ms minimum applies only after portal mounting; the native launch image is static and disappears when the web view paints. Matching mark geometry and background colors provides continuity without introducing cross-layout state.
5. Change only `manifest.background_color` to the portal light canvas. Android keeps its platform-generated icon splash; `theme_color`, icons, install behavior, and caching remain unchanged.

## Risks / Trade-offs

- [The full Apple matrix adds many binary assets] → Use generator compression, stable naming, and committed output so the cost is explicit and reproducible.
- [Stored portal theme can differ from system theme] → iOS selects by system color scheme, then the portal applies its stored preference; exact continuity is guaranteed for system-following users and degrades to one controlled canvas transition otherwise.
- [Generator updates could change the matrix] → Pin through the lockfile and require the asset regression test to validate every configured link and PNG dimension.
- [Native device verification cannot be automated in Vitest] → Require production-build inspection plus a manual installed-PWA pass on representative iPhone, iPad, and Android devices before release.

