## 1. Regression contracts

- [x] 1.1 Add failing PWA tests for Apple startup links, light/dark and orientation coverage, PNG signatures/dimensions, manifest continuity, and unchanged cache policy
- [x] 1.2 Add failing tenant-layout/component tests for pending bootstrap, the 300 ms minimum interval, dismissal, accessibility, reduced motion, and portal-only mounting

## 2. Reproducible startup assets

- [x] 2.1 Add the official PWA asset generator dependency, source/config, and package script without replacing existing manifest icons
- [x] 2.2 Generate and commit compressed light/dark portrait/landscape startup PNGs for all supported iPhone and iPad targets

## 3. Runtime integration

- [x] 3.1 Register media-qualified `apple-touch-startup-image` links and align the manifest background with the portal light canvas
- [x] 3.2 Align the portal splash mark geometry with native imagery while preserving bootstrap ownership, animation, reduced motion, and layout scope

## 4. Documentation and verification

- [x] 4.1 Sync the accepted PWA specification and developer documentation with startup-image generation and launch continuity behavior
- [x] 4.2 Run focused tests, OpenSpec validation, typecheck, full tests, lint, production build, and record remaining manual device checks

  Remaining rollout check: verify installed-PWA cold/warm launches on iPhone and iPad in light/dark system modes, plus Android, on physical devices before production promotion.
