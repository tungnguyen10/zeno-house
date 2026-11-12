import type { ReadinessCode } from '~/types/building-contract-profile'

export const READINESS_LABELS: Record<ReadinessCode, { label: string; anchor: string }> = {
  'lessor.full_name': { label: 'Họ tên bên cho thuê', anchor: 'contract-profile' },
  'lessor.date_of_birth': { label: 'Ngày sinh bên cho thuê', anchor: 'contract-profile' },
  'lessor.permanent_address': { label: 'Địa chỉ thường trú bên cho thuê', anchor: 'contract-profile' },
  'lessor.id_number': { label: 'Số CMND/CCCD bên cho thuê', anchor: 'contract-profile' },
  'lessor.id_issued_date': { label: 'Ngày cấp CMND/CCCD', anchor: 'contract-profile' },
  'lessor.id_issued_place': { label: 'Nơi cấp CMND/CCCD', anchor: 'contract-profile' },
  'lessor.phone': { label: 'Số điện thoại bên cho thuê', anchor: 'contract-profile' },
  'contract.default_term_months': { label: 'Thời hạn hợp đồng mặc định', anchor: 'contract-profile' },
  'contract.default_deposit_months': { label: 'Số tháng cọc mặc định', anchor: 'contract-profile' },
  'terms.notice_days': { label: 'Số ngày báo trước', anchor: 'contract-profile' },
  'terms.deposit_refund_days': { label: 'Số ngày hoàn cọc', anchor: 'contract-profile' },
  'terms.renewal_months': { label: 'Số tháng tự gia hạn', anchor: 'contract-profile' },
  'terms.extra_occupant_fee': { label: 'Phí người ở vượt số đăng ký', anchor: 'contract-profile' },
  'terms.drilling_fee': { label: 'Phí khoan tường', anchor: 'contract-profile' },
  'terms.fingerprint_reset_fee': { label: 'Phí làm lại vân tay', anchor: 'contract-profile' },
  'billing.schedule': { label: 'Ngày phát hành hóa đơn và hạn thanh toán', anchor: 'edit' },
  'billing.electricity_rate': { label: 'Đơn giá điện', anchor: 'edit' },
  'billing.water_rate': { label: 'Đơn giá nước', anchor: 'edit' },
  invoice_profile: { label: 'Hồ sơ thanh toán trên hóa đơn', anchor: 'invoice-profile' },
}
