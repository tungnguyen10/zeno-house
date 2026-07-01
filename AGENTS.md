## Icon Usage

- Do not inline `<svg>` in Vue templates for app icons.
- Use the existing `nuxt-svgo` convention: add SVG files to `app/assets/icons/` and render them as `IconName` components.
- Keep inline SVG out of components unless it is a genuinely custom drawing that cannot reasonably live in the icon asset set.
