## 1. Create SVG instruction file

- [x] 1.1 Create `instructions/svg.md` with placement rules: all SVG icons go in `app/assets/icons/` as flat kebab-case files, no subdirectories
- [x] 1.2 Add component usage section: `<IconSearch />` auto-imported via `nuxt-svgo`, no import needed; document the `icon` prefix and PascalCase mapping from filename
- [x] 1.3 Add sizing section: use Tailwind `size-*` or `w-* h-*` utilities on the component, never HTML `width`/`height` attributes
- [x] 1.4 Add color/theming section: icons MUST use `currentColor`; brand SVGs with hardcoded colors go in `public/` and use `<img>` instead
- [x] 1.5 Add anti-patterns section: DON'T use `<img src="...svg">`, DON'T copy-paste raw `<svg>` markup, DON'T put icons in subdirectories, DON'T hardcode hex colors in icons

## 2. Register in CLAUDE.md

- [x] 2.1 Add `@instructions/svg.md` line to the Sub-instructions section in `CLAUDE.md`
