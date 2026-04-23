import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { data: profile } = await client
    .from('profiles')
    .select('role, full_name, created_at')
    .eq('id', user.id)
    .single() as { data: { role: string; full_name: string | null; created_at: string } | null; error: unknown }

  return {
    id: user.id,
    email: user.email,
    role: profile?.role ?? null,
    full_name: profile?.full_name ?? null,
    created_at: profile?.created_at ?? '',
  }
})
