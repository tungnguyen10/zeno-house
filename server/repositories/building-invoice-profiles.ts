import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '~/types/database.types'
import type { BuildingInvoiceProfileRow } from '~/utils/mappers/building-invoice-profile'
import { db as serverSupabaseClient } from '../utils/db'

const ASSET_BUCKET = 'building-invoice-assets'
const SIGNED_URL_TTL_SECONDS = 60 * 10
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type ProfileDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'building_invoice_profiles'> & {
      building_invoice_profiles: {
        Row: BuildingInvoiceProfileRow
        Insert: Omit<BuildingInvoiceProfileRow, 'created_at' | 'updated_at' | 'legacy_backfilled_at'> & {
          created_at?: string | null
          updated_at?: string | null
          legacy_backfilled_at?: string | null
        }
        Update: Partial<BuildingInvoiceProfileRow>
        Relationships: []
      }
    }
  }
}

interface ProfileRpcArgs {
  p_building_id: string
  p_actor_id: string
  p_bank_name: string
  p_account_holder: string
  p_account_number: string
  p_transfer_content_template: string
  p_qr_image_path: string | null
  p_logo_image_path: string | null
  p_remove_logo: boolean
}

type ProfileRpc = (
  functionName: 'upsert_building_invoice_profile',
  args: ProfileRpcArgs,
) => PromiseLike<{ data: Json | null; error: unknown }>

function client(event: H3Event): SupabaseClient<ProfileDatabase> {
  return serverSupabaseClient(event) as unknown as SupabaseClient<ProfileDatabase>
}

export interface SaveBuildingInvoiceProfileInput {
  buildingId: string
  actorId: string
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContentTemplate: string
  qrImagePath: string | null
  logoImagePath: string | null
  removeLogo: boolean
}

export const BuildingInvoiceProfileRepository = {
  async findInvoiceSnapshotsByIds(
    event: H3Event,
    invoiceIds: string[],
  ): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>(invoiceIds.map(id => [id, null]))
    if (invoiceIds.length === 0) return result
    const { data, error } = await client(event)
      .from('invoices')
      .select('id, invoice_profile_snapshot' as '*')
      .in('id', invoiceIds)
    if (error) throwDbError(error, 'buildingInvoiceProfile.findInvoiceSnapshotsByIds')
    for (const row of (data ?? []) as unknown as Array<{ id: string; invoice_profile_snapshot: unknown }>) {
      result.set(row.id, row.invoice_profile_snapshot)
    }
    return result
  },

  async findByBuildingId(event: H3Event, buildingId: string): Promise<BuildingInvoiceProfileRow | null> {
    const { data, error } = await client(event)
      .from('building_invoice_profiles')
      .select('*')
      .eq('building_id', buildingId)
      .maybeSingle()
    if (error) throwDbError(error, 'buildingInvoiceProfile.findByBuildingId')
    return data
  },

  async saveWithLegacyBackfill(
    event: H3Event,
    input: SaveBuildingInvoiceProfileInput,
  ): Promise<{ profile: BuildingInvoiceProfileRow; backfilledCount: number }> {
    // Keep the cast at the repository boundary until the cloud migration is
    // applied and database.types.ts can be regenerated from Supabase.
    const profileRpc = client(event).rpc as unknown as ProfileRpc
    const { data, error } = await profileRpc('upsert_building_invoice_profile', {
      p_building_id: input.buildingId,
      p_actor_id: input.actorId,
      p_bank_name: input.bankName,
      p_account_holder: input.accountHolder,
      p_account_number: input.accountNumber,
      p_transfer_content_template: input.transferContentTemplate,
      p_qr_image_path: input.qrImagePath,
      p_logo_image_path: input.logoImagePath,
      p_remove_logo: input.removeLogo,
    })
    if (error) throwDbError(error, 'buildingInvoiceProfile.saveWithLegacyBackfill')
    const result = data as unknown as { profile?: BuildingInvoiceProfileRow; backfilled_count?: number }
    if (!result.profile) {
      throwInternal(new Error('Profile RPC returned no profile'), 'buildingInvoiceProfile.saveWithLegacyBackfill')
    }
    return { profile: result.profile, backfilledCount: Number(result.backfilled_count ?? 0) }
  },

  async uploadAsset(
    event: H3Event,
    buildingId: string,
    kind: 'qr' | 'logo',
    file: { type: string; data: Buffer },
  ): Promise<string> {
    const extension = EXTENSIONS[file.type]
    if (!extension) throwValidationError('Ảnh phải có định dạng JPEG, PNG hoặc WebP')
    const path = `${buildingId}/${kind}/${randomUUID()}.${extension}`
    const { error } = await client(event).storage.from(ASSET_BUCKET).upload(path, file.data, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throwDbError(error, 'buildingInvoiceProfile.uploadAsset')
    return path
  },

  async removeAssets(event: H3Event, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await client(event).storage.from(ASSET_BUCKET).remove(paths)
    if (error) throwDbError(error, 'buildingInvoiceProfile.removeAssets')
  },

  async signAsset(event: H3Event, path: string): Promise<string> {
    const { data, error } = await client(event).storage
      .from(ASSET_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throwDbError(error, 'buildingInvoiceProfile.signAsset')
    return data.signedUrl
  },
}
