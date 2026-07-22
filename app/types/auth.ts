import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { UserRole } from '~/utils/constants/roles'
import type { Database } from '~/types/database.types'
import type { ApiPerformanceContext } from '../../server/utils/performance'
import type { TenantOnboardingStage } from '~/utils/tenant-onboarding'
import type { TenantHousingContext } from '../../server/repositories/tenant-portal/housing'
import type { Building } from '~/types/buildings'

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
    __tenantScope?: Map<string, Promise<string | null>>
    __tenantHousing?: Map<string, Promise<TenantHousingContext | null>>
    __authAccounts?: Map<string, Promise<AuthAccount | null>>
    __buildingLookups?: Map<string, Promise<Building | null>>
    __instrumentedDb?: SupabaseClient<Database>
    apiPerformance?: ApiPerformanceContext
  }
}

export interface AuthAccount {
  id: string
  email: string | null
  emailConfirmed: boolean
  role: UserRole | null
  tenantOnboardingStage: TenantOnboardingStage | null
}
