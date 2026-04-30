// @nuxtjs/supabase server helpers — must be explicitly imported in each server route:
//
//   import { serverSupabaseClient }      from '#supabase/server'  → Promise<SupabaseClient> (user JWT, respects RLS)
//   import { serverSupabaseUser }        from '#supabase/server'  → Promise<User | null>
//   import { serverSupabaseSession }     from '#supabase/server'  → Promise<Session | null>
//
// Prefer serverSupabaseClient over serverSupabaseServiceRole — the user-scoped client
// forwards the caller's JWT so RLS works correctly and auth.uid() is available.
