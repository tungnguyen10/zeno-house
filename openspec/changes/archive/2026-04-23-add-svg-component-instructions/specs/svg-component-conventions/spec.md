## ADDED Requirements

### Requirement: SVG icons are placed in app/assets/icons/ as flat files
The system SHALL store all SVG icon files directly under `app/assets/icons/` with no subdirectories, using kebab-case filenames.

#### Scenario: Developer adds a new icon
- **WHEN** a developer adds a new SVG icon to the project
- **THEN** the file SHALL be placed at `app/assets/icons/<kebab-case-name>.svg` with no subdirectories

### Requirement: SVG icons are used as auto-imported Vue components
The system SHALL use SVG icons exclusively via the `<Icon*>` component auto-imported by `nuxt-svgo`, never via `<img>` tags or raw inline `<svg>` markup.

#### Scenario: Icon component name derived from filename
- **WHEN** a file `app/assets/icons/chevron-down.svg` exists
- **THEN** the component SHALL be available as `<IconChevronDown />` without any import statement

#### Scenario: Icon used in template
- **WHEN** a developer renders an icon in a Vue template
- **THEN** they SHALL write `<IconSearch />` and NOT `<img src="~/assets/icons/search.svg" />` or copy-pasted inline SVG markup

### Requirement: SVG icon size is set via Tailwind class
The system SHALL set icon dimensions using Tailwind size utilities on the component element, not via HTML `width`/`height` attributes.

#### Scenario: Icon sized with Tailwind
- **WHEN** an icon is rendered in a template
- **THEN** size SHALL be set via `class="size-4"`, `class="w-5 h-5"`, or equivalent Tailwind utility
- **THEN** the HTML `width` and `height` attributes SHALL NOT be used directly on the component

### Requirement: SVG icons use currentColor for theming
The system SHALL require that SVG files in `app/assets/icons/` use `currentColor` for stroke and fill values so that Tailwind text color utilities propagate correctly.

#### Scenario: Icon color inherits from text color
- **WHEN** an icon component has `class="text-primary"` applied
- **THEN** the icon stroke/fill SHALL visually reflect the primary color

#### Scenario: Brand SVG with hardcoded color
- **WHEN** an SVG file contains hardcoded hex colors (e.g., a brand logo)
- **THEN** that file SHALL NOT be placed in `app/assets/icons/`
- **THEN** it SHALL be placed in `public/` and referenced via `<img src="/brand-logo.svg" />`
