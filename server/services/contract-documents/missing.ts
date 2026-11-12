import type { ContractDocumentSources, DocPartySource } from './build-data'
import { formatPaymentWindow } from '~/utils/format/payment-window'

export interface MissingItem { code: string; label: string }

const PARTY_FIELDS: { key: keyof DocPartySource; label: string }[] = [
  { key: 'fullName', label: 'Họ tên' },
  { key: 'dateOfBirth', label: 'Ngày sinh' },
  { key: 'permanentAddress', label: 'Địa chỉ thường trú' },
  { key: 'idNumber', label: 'Số CMND/CCCD' },
  { key: 'idIssuedDate', label: 'Ngày cấp CMND/CCCD' },
  { key: 'idIssuedPlace', label: 'Nơi cấp CMND/CCCD' },
  { key: 'phone', label: 'Số điện thoại' },
]
const FIELD_CODE: Record<keyof DocPartySource, string> = {
  fullName: 'full_name', dateOfBirth: 'date_of_birth', permanentAddress: 'permanent_address',
  idNumber: 'id_number', idIssuedDate: 'id_issued_date', idIssuedPlace: 'id_issued_place', phone: 'phone',
}

function partyMissing(prefix: string, suffix: string, src: DocPartySource): MissingItem[] {
  return PARTY_FIELDS
    .filter(f => src[f.key] == null || String(src[f.key]).trim() === '')
    .map(f => ({ code: `${prefix}.${FIELD_CODE[f.key]}`, label: `${f.label} ${suffix}` }))
}

export function collectMissing(src: ContractDocumentSources): MissingItem[] {
  const out: MissingItem[] = []

  const lessorSrc: DocPartySource = {
    fullName: src.lessor?.lessorFullName ?? null, dateOfBirth: src.lessor?.lessorDateOfBirth ?? null,
    permanentAddress: src.lessor?.lessorPermanentAddress ?? null, idNumber: src.lessor?.lessorIdNumber ?? null,
    idIssuedDate: src.lessor?.lessorIdIssuedDate ?? null, idIssuedPlace: src.lessor?.lessorIdIssuedPlace ?? null,
    phone: src.lessor?.lessorPhone ?? null,
  }
  out.push(...partyMissing('lessor', 'bên cho thuê', lessorSrc))
  out.push(...partyMissing('tenant', 'khách đứng tên', src.tenant))
  src.occupants.forEach((o, i) => {
    const who = o.fullName ? `người ở ${o.fullName}` : `người ở cùng #${i + 1}`
    out.push(...partyMissing(`occupant[${i + 1}]`, who, o))
  })

  if (!src.invoiceProfile) out.push({ code: 'invoice_profile', label: 'Hồ sơ thanh toán trên hóa đơn' })
  if (!formatPaymentWindow(src.building)) out.push({ code: 'billing.schedule', label: 'Ngày phát hành hóa đơn và hạn thanh toán' })

  const terms: { field: 'noticeDays' | 'depositRefundDays' | 'renewalMonths' | 'extraOccupantFee' | 'drillingFee' | 'fingerprintResetFee'; code: string; label: string }[] = [
    { field: 'noticeDays', code: 'terms.notice_days', label: 'Số ngày báo trước' },
    { field: 'depositRefundDays', code: 'terms.deposit_refund_days', label: 'Số ngày hoàn cọc' },
    { field: 'renewalMonths', code: 'terms.renewal_months', label: 'Số tháng tự gia hạn' },
    { field: 'extraOccupantFee', code: 'terms.extra_occupant_fee', label: 'Phí người ở vượt' },
    { field: 'drillingFee', code: 'terms.drilling_fee', label: 'Phí khoan tường' },
    { field: 'fingerprintResetFee', code: 'terms.fingerprint_reset_fee', label: 'Phí làm lại vân tay' },
  ]
  for (const t of terms) {
    if (src.lessor == null || src.lessor[t.field] == null) out.push({ code: t.code, label: t.label })
  }

  return out
}
