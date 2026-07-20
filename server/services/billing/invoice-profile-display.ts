import type { H3Event } from 'h3'
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'
import { parseStoredInvoiceProfileSnapshot } from '~/utils/mappers/building-invoice-profile'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'

export const InvoiceProfileDisplayService = {
  async resolveMany(
    event: H3Event,
    snapshotsByInvoiceId: Map<string, unknown>,
  ): Promise<Map<string, InvoiceProfileDisplay | null>> {
    const signedUrlByPath = new Map<string, Promise<string>>()
    const sign = (path: string) => {
      const existing = signedUrlByPath.get(path)
      if (existing) return existing
      const pending = BuildingInvoiceProfileRepository.signAsset(event, path)
      signedUrlByPath.set(path, pending)
      return pending
    }

    const entries = await Promise.all([...snapshotsByInvoiceId.entries()].map(async ([invoiceId, raw]) => {
      const snapshot = parseStoredInvoiceProfileSnapshot(raw)
      if (!snapshot) return [invoiceId, null] as const
      const [qrImageUrl, logoImageUrl] = await Promise.all([
        sign(snapshot.qrImagePath),
        snapshot.logoImagePath ? sign(snapshot.logoImagePath) : Promise.resolve(null),
      ])
      return [invoiceId, {
        bankName: snapshot.bankName,
        accountHolder: snapshot.accountHolder,
        accountNumber: snapshot.accountNumber,
        transferContent: snapshot.transferContent,
        qrImageUrl,
        logoImageUrl,
        snapshottedAt: snapshot.snapshottedAt,
      } satisfies InvoiceProfileDisplay] as const
    }))

    return new Map(entries)
  },
}
