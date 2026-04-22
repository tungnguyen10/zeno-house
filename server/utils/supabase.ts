// @nuxtjs/supabase server helpers — must be explicitly imported in each server route:
//
//   import { serverSupabaseClient }      from '#supabase/server'  → Promise<SupabaseClient> (user JWT, respects RLS)
//   import { serverSupabaseServiceRole } from '#supabase/server'  → SupabaseClient (service role, bypasses RLS)
//   import { serverSupabaseUser }        from '#supabase/server'  → Promise<User | null>
//   import { serverSupabaseSession }     from '#supabase/server'  → Promise<Session | null>
