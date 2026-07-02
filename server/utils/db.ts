import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'

/**
 * Server-side database client for repositories and query services.
 *
 * Authorization is enforced at the service layer (`can()` + `assertBuildingScope` /
 * `getAssignedBuildingIds`), so data access runs through the service-role client.
 * Row Level Security stays ENABLED as a deny-by-default safety net for any
 * accidental direct client access — the app client never queries business tables.
 */
export function db<_Schema = Database>(event: H3Event): SupabaseClient<Database> {
  return serverSupabaseServiceRole<Database>(event)
}
