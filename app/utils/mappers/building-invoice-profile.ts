import { z } from 'zod'
import type {
  BuildingInvoiceProfile,
  StoredInvoiceProfileSnapshot,
} from '~/types/building-invoice-profile'

export interface BuildingInvoiceProfileRow {
  building_id: string
  bank_name: string
  account_holder: string
  account_number: string
  transfer_content_template: string
  qr_image_path: string
  logo_image_path: string | null
  legacy_backfilled_at: string | null
  created_at: string | null
  updated_at: string | null
  updated_by: string | null
}

const storedSnapshotSchema = z.object({
  schema_version: z.literal(1),
  bank_name: z.string().min(1),
  account_holder: z.string().min(1),
  account_number: z.string().min(1),
  transfer_content: z.string().min(1),
  qr_image_path: z.string().min(1),
  logo_image_path: z.string().min(1).nullable(),
  snapshotted_at: z.string().min(1),
})

export function mapBuildingInvoiceProfile(
  row: BuildingInvoiceProfileRow,
  assets: { qrImageUrl: string; logoImageUrl: string | null },
): BuildingInvoiceProfile {
  return {
    buildingId: row.building_id,
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    accountNumber: row.account_number,
    transferContentTemplate: row.transfer_content_template,
    qrImageUrl: assets.qrImageUrl,
    logoImageUrl: assets.logoImageUrl,
    legacyBackfilledAt: row.legacy_backfilled_at,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by,
  }
}

export function parseStoredInvoiceProfileSnapshot(
  value: unknown,
): StoredInvoiceProfileSnapshot | null {
  const result = storedSnapshotSchema.safeParse(value)
  if (!result.success) return null
  return {
    schemaVersion: 1,
    bankName: result.data.bank_name,
    accountHolder: result.data.account_holder,
    accountNumber: result.data.account_number,
    transferContent: result.data.transfer_content,
    qrImagePath: result.data.qr_image_path,
    logoImagePath: result.data.logo_image_path,
    snapshottedAt: result.data.snapshotted_at,
  }
}
