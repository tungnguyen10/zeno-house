import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { BuildingInvoiceEmailSettingsRow } from '~/utils/mappers/invoice-email'
import { db as serverSupabaseClient } from '../utils/db'

type InvoiceEmailSettingsDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      building_invoice_email_settings: {
        Row: BuildingInvoiceEmailSettingsRow
        Insert: {
          building_id: string
          auto_send_enabled?: boolean
          updated_by?: string | null
        }
        Update: {
          auto_send_enabled?: boolean
          updated_by?: string | null
        }
        Relationships: []
      }
    }
  }
}

function client(event: H3Event): SupabaseClient<InvoiceEmailSettingsDatabase> {
  return serverSupabaseClient(event) as unknown as SupabaseClient<InvoiceEmailSettingsDatabase>
}

type SaveSettingsRpc = (
  name: 'update_invoice_email_settings_with_audit',
  args: {
    p_building_id: string
    p_auto_send_enabled: boolean
    p_actor_id: string
    p_operation_id: string
  },
) => PromiseLike<{ data: BuildingInvoiceEmailSettingsRow | null; error: unknown }>

export const BuildingInvoiceEmailSettingsRepository = {
  async findByBuildingId(
    event: H3Event,
    buildingId: string,
  ): Promise<BuildingInvoiceEmailSettingsRow | null> {
    const { data, error } = await client(event)
      .from('building_invoice_email_settings')
      .select('*')
      .eq('building_id', buildingId)
      .maybeSingle()
    if (error) throwDbError(error, 'buildingInvoiceEmailSettings.findByBuildingId')
    return data
  },

  async save(
    event: H3Event,
    input: { buildingId: string; autoSendEnabled: boolean; updatedBy: string; operationId: string },
  ): Promise<BuildingInvoiceEmailSettingsRow> {
    const rpc = client(event).rpc as unknown as SaveSettingsRpc
    const { data, error } = await rpc('update_invoice_email_settings_with_audit', {
      p_building_id: input.buildingId,
      p_auto_send_enabled: input.autoSendEnabled,
      p_actor_id: input.updatedBy,
      p_operation_id: input.operationId,
    })
    if (error) throwDbError(error, 'buildingInvoiceEmailSettings.save')
    if (!data) throwInternal(new Error('Settings RPC returned no row'), 'buildingInvoiceEmailSettings.save')
    return data
  },
}
