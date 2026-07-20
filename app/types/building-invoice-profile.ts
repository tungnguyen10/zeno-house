export interface BuildingInvoiceProfile {
  buildingId: string
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContentTemplate: string
  qrImageUrl: string
  logoImageUrl: string | null
  legacyBackfilledAt: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

export interface BuildingInvoiceProfileSaveInput {
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContentTemplate: string
  qrImage: File | null
  logoImage: File | null
  removeLogo: boolean
}

export interface StoredInvoiceProfileSnapshot {
  schemaVersion: 1
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContent: string
  qrImagePath: string
  logoImagePath: string | null
  snapshottedAt: string
}

export interface InvoiceProfileDisplay {
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContent: string
  qrImageUrl: string
  logoImageUrl: string | null
  snapshottedAt: string
}
