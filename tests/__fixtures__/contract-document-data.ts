// Invented (non-real) data covering every manifest path for renderer tests.
export function contractDocumentFixture(): Record<string, unknown> {
  const party = (name: string) => ({
    full_name: name,
    date_of_birth: '01/01/1990',
    permanent_address: '12 Lê Lợi, Huế',
    id_number: '012345678901',
    id_issued_date: '01/05/2021',
    id_issued_place: 'Cục CS QLHC',
    phone: '0901234567',
  })
  return {
    building: { brand_name: 'Zeno House', address: '1 Nguyễn Huệ' },
    contract: {
      number: 'HD-2026-001',
      signed_date_text: 'ngày 12 tháng 11 năm 2026',
      start_date: '12/11/2026',
      end_date: '11/11/2027',
      handover_date: '12/11/2026',
      monthly_rent_display: '3.000.000',
      deposit_display: '3.000.000',
      deposit_words: 'Ba triệu đồng',
      deposit_months_equiv: '1',
      occupant_count: '2',
      vehicle_count: '1',
      signed_copies: '2',
      copies_per_party: '1',
    },
    lessor: party('Chủ Nhà Giả Lập'),
    tenant: party('Người Thuê Giả Lập'),
    room: { number: 'P101' },
    utilities: { electricity_price_display: '3.500 đ/kWh', water_price_display: '15.000', water_unit: 'm³' },
    payment: {
      due_day_start: '1',
      due_day_end: '5',
      overdue_clause: 'Nếu sau ngày 10 của tháng không đóng tiền, Bên A có quyền chấm dứt hợp đồng.',
      account_holder: 'CHU NHA',
      account_number: '0123456789',
      bank_name: 'Vietcombank',
      transfer_content: 'ZEN P101 tiền phòng kỳ',
    },
    terms: {
      notice_days: '30',
      extra_occupant_fee_display: '500.000',
      drilling_fee_display: '50.000',
      fingerprint_reset_fee_display: '100.000',
      deposit_refund_days: '7',
      renewal_months: '6',
    },
    occupants: [
      { index: 1, full_name: 'Người Ở A', date_of_birth: '02/02/1992', id_number: '012345678902', permanent_address: 'Hà Nội', phone: '0900000001' },
      { index: 2, full_name: 'Người Ở B', date_of_birth: '03/03/1993', id_number: '012345678903', permanent_address: 'Đà Nẵng', phone: '0900000002' },
    ],
    vehicles: [
      { index: 1, owner_name: 'Người Thuê Giả Lập', plate_number: '59X1 123.45', note: 'Xe máy' },
    ],
    services: [
      { index: 1, name: 'Vệ sinh', unit_price_display: '50.000', unit_label: 'phòng/tháng', note: '' },
      { index: 2, name: 'Internet', unit_price_display: '100.000', unit_label: 'phòng/tháng', note: 'Chung' },
    ],
    inventory: [
      { index: 1, name: 'Giường đơn', quantity: '1', condition_label: 'Tốt', unit_value_display: '2.000.000', note: '' },
    ],
    inventory_total_display: '2.000.000',
    inventory_empty_text: '',
  }
}
