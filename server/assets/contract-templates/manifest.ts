export interface TemplateManifestEntry {
  key: 'hop-dong-thue-phong' | 'phu-luc-hop-dong'
  version: number
  file: string
  requiredPaths: string[]
}

const PARTY = ['full_name', 'date_of_birth', 'permanent_address', 'id_number', 'id_issued_date', 'id_issued_place', 'phone']

export const CONTRACT_TEMPLATES: Record<TemplateManifestEntry['key'], TemplateManifestEntry> = {
  'hop-dong-thue-phong': {
    key: 'hop-dong-thue-phong',
    version: 1,
    file: 'hop-dong-thue-phong/v1.docx',
    requiredPaths: [
      'building.brand_name', 'building.address', 'contract.number', 'contract.signed_date_text',
      ...PARTY.map(f => `lessor.${f}`), ...PARTY.map(f => `tenant.${f}`),
      'room.number', 'contract.start_date', 'contract.end_date', 'contract.handover_date',
      'contract.monthly_rent_display', 'utilities.electricity_price_display', 'utilities.water_price_display', 'utilities.water_unit',
      'contract.vehicle_count', 'contract.occupant_count', 'terms.extra_occupant_fee_display', 'terms.drilling_fee_display',
      'payment.due_day_start', 'payment.due_day_end', 'payment.overdue_clause', 'terms.fingerprint_reset_fee_display',
      'payment.account_holder', 'payment.account_number', 'payment.bank_name', 'payment.transfer_content',
      'contract.deposit_display', 'contract.deposit_words', 'contract.deposit_months_equiv',
      'terms.notice_days', 'terms.deposit_refund_days', 'terms.renewal_months',
      'contract.signed_copies', 'contract.copies_per_party', 'inventory_total_display', 'inventory_empty_text',
    ],
  },
  'phu-luc-hop-dong': {
    key: 'phu-luc-hop-dong',
    version: 1,
    file: 'phu-luc-hop-dong/v1.docx',
    requiredPaths: [
      'appendix.number', 'contract.number', 'appendix.signed_date_text', 'appendix.title', 'appendix.public_content',
      'appendix.effective_date', ...PARTY.map(f => `lessor.${f}`), ...PARTY.map(f => `tenant.${f}`),
    ],
  },
}
