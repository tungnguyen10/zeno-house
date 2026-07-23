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
    input: { buildingId: string; autoSendEnabled: boolean; updatedBy: string },
  ): Promise<BuildingInvoiceEmailSettingsRow> {
    const payload = {
      building_id: input.buildingId,
      auto_send_enabled: input.autoSendEnabled,
      updated_by: input.updatedBy,
    }
    const { data, error } = await client(event)
      .from('building_invoice_email_settings')
      .upsert(payload as never, { onConflict: 'building_id' })
      .select('*')
      .single()
    if (error) throwDbError(error, 'buildingInvoiceEmailSettings.save')
    return data
  },
}
