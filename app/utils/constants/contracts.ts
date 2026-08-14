export const CONTRACT_PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'Đặt cọc',
  prepaid_rent: 'Trả trước tiền thuê',
  rent: 'Tiền thuê',
  other: 'Khác',
}

export const CONTRACT_RENEWAL_MODE_LABELS: Record<string, string> = {
  extend: 'Gia hạn tại chỗ',
  new_contract: 'Hợp đồng mới',
}

export const CONTRACT_AMENDMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  scheduled: 'Đã ban hành',
  applied: 'Đang áp dụng',
  cancelled: 'Đã hủy',
}

export const CONTRACT_AMENDMENT_TERM_LABELS: Record<string, string> = {
  monthlyRent: 'Tiền thuê hàng tháng',
  deposit: 'Tiền cọc',
  paymentDueDay: 'Ngày thanh toán',
  occupantCount: 'Số người tối đa',
  discountAmount: 'Giảm giá',
  surchargeAmount: 'Phụ thu',
}
