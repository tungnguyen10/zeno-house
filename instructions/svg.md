# SVG Icons

## Setup

`nuxt-svgo` is configured in `nuxt.config.ts`:

```ts
svgo: {
  autoImportPath: "~/assets/icons",
  componentPrefix: "icon",
}
```

All `.svg` files placed in `app/assets/icons/` are automatically available as Vue components — no import needed.

## File Placement

All SVG icons live in `app/assets/icons/` as flat kebab-case files. No subdirectories.

```
app/assets/icons/
├── search.svg          → <IconSearch />
├── chevron-down.svg    → <IconChevronDown />
├── x-circle.svg        → <IconXCircle />
└── briefcase.svg       → <IconBriefcase />
```

## Workflow: Check Before Creating

**Before adding any SVG, check `app/assets/icons/` first.** If the icon exists, reuse it directly. Only create a new `.svg` file if it is genuinely absent.

1. Look in `app/assets/icons/` for the icon you need
2. If found → use `<IconName />` directly
3. If not found → create a new `.svg` in `app/assets/icons/` using `currentColor`, then use `<IconName />`

## Component Usage

Use the auto-imported `<Icon*>` component. The prefix is `icon` and the filename is converted to PascalCase:

```vue
<!-- Good -->
<IconSearch />
<IconChevronDown />
<IconBriefcase class="size-5 text-primary" />

<!-- Bad — don't use img or raw inline SVG -->
<img src="~/assets/icons/search.svg" />
<svg xmlns="..."><!-- copy-pasted markup --></svg>
```

## Sizing

Set icon size with Tailwind utilities on the component. Never use HTML `width`/`height` attributes:

```vue
<!-- Good -->
<IconSearch class="size-4" />
<IconSearch class="w-5 h-5" />

<!-- Bad -->
<IconSearch width="20" height="20" />
```

## Color & Theming

New SVG files MUST use `currentColor` for stroke and fill so Tailwind text-color utilities apply:

```vue
<IconSearch class="text-gray-500" />       <!-- gray stroke/fill -->
<IconSearch class="text-primary" />         <!-- primary color -->
<IconSearch class="text-red-500" />         <!-- error state -->
```

Example SVG structure using `currentColor`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths here -->
</svg>
```

> **Note**: Some existing icons (e.g. `google.svg`) may have hardcoded brand colors and won't respond to Tailwind text-color utilities — that is expected. All newly created icons must use `currentColor`.

## Anti-patterns

- **DON'T** use `<img src="...svg">` for SVGs — loses component API, theming, and sizing control
- **DON'T** copy-paste raw `<svg>` markup inline — unmanageable at scale
- **DON'T** create subdirectories inside `app/assets/icons/` — auto-import is flat
- **DON'T** use `width`/`height` HTML attributes — use Tailwind `size-*` or `w-* h-*`
- **DON'T** hardcode colors in new SVG files — use `currentColor`
- **DON'T** create a new icon file without first checking if one already exists in `app/assets/icons/`
