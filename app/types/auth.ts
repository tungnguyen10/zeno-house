import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { UserRole } from '~/utils/constants/roles'
import type { Database } from '~/types/database.types'
import type { ApiPerformanceContext } from '../../server/utils/performance'
import type { TenantOnboardingStage } from '~/utils/tenant-onboarding'

export type AuthUser = User & {
  app_metadata: {
    role: UserRole | null
    tenant_onboarding?: TenantOnboardingStage
  }
}

declare module 'h3' {
  interface H3EventContext {
    user: AuthUser | null
    __buildingScope?: string[] | null
    __instrumentedDb?: SupabaseClient<Database>
    apiPerformance?: ApiPerformanceContext
  }
}
