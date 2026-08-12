## Why

The installed PWA currently relies on a manifest-generated Android launch screen and has no explicit iOS/iPadOS startup images, so launch branding can flash or jump before the existing tenant portal splash appears. The accepted PWA contract already requires a themed native-looking splash, and the implementation needs to match the portal's current light/dark identity.

## What Changes

- Add reproducible light and dark Apple startup images for supported iPhone and iPad sizes and orientations.
- Register device-, orientation-, density-, and color-scheme-specific `apple-touch-startup-image` links.
- Align the manifest fallback background with the portal light canvas while preserving Android's platform-generated splash.
- Keep the existing tenant bootstrap splash and align its brand mark placement with the native launch assets without adding splash behavior to auth or dashboard layouts.
- Add regression coverage for generated assets, metadata, splash timing, accessibility, and reduced motion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pwa-installability`: Clarify full iPhone/iPad light/dark startup-image coverage and continuity into the tenant portal bootstrap splash.

## Impact

- PWA head metadata and manifest configuration in Nuxt.
- Apple startup-image assets under `public/` and a reproducible asset-generator configuration.
- Tenant layout/component regression tests; no API, route, DTO, database, or service-worker caching changes.
- Adds `@vite-pwa/assets-generator` as a development-only dependency.
