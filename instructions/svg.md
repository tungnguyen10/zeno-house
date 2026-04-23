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

Icons in `app/assets/icons/` MUST use `currentColor` for stroke and fill. This lets Tailwind text-color utilities propagate naturally:

```vue
<IconSearch class="text-gray-500" />       <!-- gray stroke/fill -->
<IconSearch class="text-primary" />         <!-- primary color -->
<IconSearch class="text-red-500" />         <!-- error state -->
```

**Brand SVGs with hardcoded colors** (logos, illustrations) MUST NOT go in `app/assets/icons/`. Place them in `public/` and reference via `<img>`:

```vue
<!-- Brand logo with hardcoded colors -->
<img src="/logo.svg" alt="Zeno House" class="h-8" />
```

## Anti-patterns

- **DON'T** use `<img src="...svg">` for icons — loses theming and accessibility
- **DON'T** copy-paste raw `<svg>` markup inline — unmanageable at scale
- **DON'T** create subdirectories inside `app/assets/icons/` — auto-import is flat
- **DON'T** hardcode hex colors in SVG files under `app/assets/icons/` — use `currentColor`
- **DON'T** use `width`/`height` HTML attributes — use Tailwind `size-*` or `w-* h-*`
