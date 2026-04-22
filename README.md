# zeno-house

Hệ thống quản lý nhà trọ — Rental Property Management System

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

## Development

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run typecheck  # TypeScript type check
npm run lint       # ESLint check
npm run lint:fix   # ESLint auto-fix
npm run build      # Production build
npm run preview    # Preview production build
```

## CI/CD — Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI GitHub App token |

## Database

Apply the migration to your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste supabase/migrations/001_initial_schema.sql into the Supabase SQL editor
```

After applying the migration, generate TypeScript types:

```bash
supabase gen types typescript --project-id <your-project-id> > app/types/database.types.ts
```
