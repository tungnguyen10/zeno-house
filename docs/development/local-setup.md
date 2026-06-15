# Local Setup

## Requirements

- Node.js compatible with the checked-in lockfile.
- npm, using the committed `package-lock.json`.
- Supabase project credentials in `.env`.

## Install And Run

```bash
npm install
npm run dev
```

The Nuxt dev server is configured with HTTPS in `nuxt.config.ts`:

```ts
devServer: {
  https: true,
}
```

Expect a local HTTPS URL from Nuxt rather than plain `http://localhost:3000`.

## Environment Variables

Nuxt runtime config is declared in `nuxt.config.ts`.

Private server runtime values:

- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `NUXT_TURNSTILE_SECRET_KEY`

Public runtime values:

- `NUXT_PUBLIC_SITE_URL`
- `NUXT_PUBLIC_GA_ID`
- `NUXT_PUBLIC_TURNSTILE_SITE_KEY`

Supabase values are consumed by `@nuxtjs/supabase`; keep service-role or secret keys out of browser-exposed variables.

## Common Commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run typecheck
npm test
npm run test:watch
npm run test:coverage
```

## Useful Entry Points

- Nuxt config: `nuxt.config.ts`
- Global styles and font face: `app/assets/scss/main.scss`
- Tailwind tokens: `tailwind.config.ts`
- Default layout: `app/layouts/default.vue`
- Auth layout: `app/layouts/auth.vue`
- Route guard: `app/middleware/auth.global.ts`
- Server auth middleware: `server/middleware/01.auth.ts`

## Development Notes

- Business data should go through `server/api/**`, not direct Supabase calls from pages or components.
- Add Zod validators before adding or expanding API input contracts.
- Add mappers before returning new DB fields to the client.
- Follow `docs/ui-patterns/design-system.md` when adding UI.
