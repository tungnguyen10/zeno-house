import type { User } from '@supabase/supabase-js'
import type { UserRole } from '~/utils/constants/roles'

export type AuthUser = User & {
  app_metadata: {
    role: UserRole | null
  }
}

declare module 'h3' {
  interface H3EventContext {
    user: AuthUser | null
    __buildingScope?: string[] | null
  }
}
