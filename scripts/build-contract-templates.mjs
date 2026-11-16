// One-off generator for versioned DOCX contract templates (PR4b Task 3).
// Reuses the original .docx container (styles, fonts, rels) and replaces
// word/document.xml with a docxtemplater-syntax body ({{ }} delimiters, no
// docxtpl/Jinja). Re-run to regenerate v1 assets.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import PizZip from 'pizzip'

const SOURCE = 'public/templates/HOP_DONG_THUE_PHONG_TEMPLATE.docx'
const OUT_DIR = 'server/assets/contract-templates'

const DOC_OPEN = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
const SECT = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
  + '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// A run with literal text (placeholders pass through; braces are valid text).
function run(text, bold) {
  const rpr = bold ? '<w:rPr><w:b/></w:rPr>' : ''
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}
function para(text, bold, align) {
  const ppr = align ? `<w:pPr><w:jc w:val="${align}"/></w:pPr>` : ''
  return `<w:p>${ppr}${text === '' ? '' : run(text, bold)}</w:p>`
}
// Paragraph mixing a label and placeholders, built from raw inline runs.
function paraRuns(runs) {
  return `<w:p>${runs}</w:p>`
}
function cell(inner, w) {
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`
}
function tableRow(cells) {
  return `<w:tr>${cells}</w:tr>`
}
// Build a looped table: header row + one body row wrapped in {{#key}}…{{/key}}.
function loopTable(key, headers, fields, widths) {
  const headerCells = headers.map((h, i) => cell(para(h, true), widths[i])).join('')
  const bodyCells = fields.map((f, i) => {
    let text = `{{${f}}}`
    if (i === 0) text = `{{#${key}}}${text}`
    if (i === fields.length - 1) text = `${text}{{/${key}}}`
    return cell(para(text), widths[i])
  }).join('')
  const borders = '<w:tblPr><w:tblBorders>'
    + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`).join('')
    + '</w:tblBorders></w:tblPr>'
  return `<w:tbl>${borders}${tableRow(headerCells)}${tableRow(bodyCells)}</w:tbl>`
}

const PARTY_LINES = (who, prefix) => [
  para(who, true),
  paraRuns(run('Họ tên: ') + run(`{{${prefix}.full_name}}`)),
  paraRuns(run('Ngày sinh: ') + run(`{{${prefix}.date_of_birth}}`)),
  paraRuns(run('CMND/CCCD: ') + run(`{{${prefix}.id_number}}`) + run(' cấp ngày ') + run(`{{${prefix}.id_issued_date}}`) + run(' tại ') + run(`{{${prefix}.id_issued_place}}`)),
  paraRuns(run('Địa chỉ thường trú: ') + run(`{{${prefix}.permanent_address}}`)),
  paraRuns(run('Điện thoại: ') + run(`{{${prefix}.phone}}`)),
].join('')

function contractBody() {
  const parts = []
  parts.push(para('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', true, 'center'))
  parts.push(para('Độc lập - Tự do - Hạnh phúc', true, 'center'))
  parts.push(paraRuns(run('{{building.brand_name}}')))
  parts.push(paraRuns(run('Địa chỉ: ') + run('{{building.address}}')))
  parts.push(para('HỢP ĐỒNG THUÊ PHÒNG', true, 'center'))
  parts.push(paraRuns(run('Số: ') + run('{{contract.number}}')))
  parts.push(paraRuns(run('Hôm nay, ') + run('{{contract.signed_date_text}}') + run(', các Bên gồm:')))
  parts.push(PARTY_LINES('BÊN CHO THUÊ (Bên A):', 'lessor'))
  parts.push(PARTY_LINES('BÊN THUÊ (Bên B):', 'tenant'))
  parts.push(para('Hai bên thống nhất ký hợp đồng với các điều khoản sau:', true))
  parts.push(paraRuns(run('Điều 1. Bên A cho Bên B thuê phòng số ') + run('{{room.number}}')
    + run(' từ ngày ') + run('{{contract.start_date}}') + run(' đến ngày ') + run('{{contract.end_date}}')
    + run('; bàn giao ngày ') + run('{{contract.handover_date}}') + run('.')))
  parts.push(paraRuns(run('Giá thuê: ') + run('{{contract.monthly_rent_display}}') + run(' đồng/tháng. Tiền cọc: ')
    + run('{{contract.deposit_display}}') + run(' đồng (') + run('{{contract.deposit_words}}')
    + run('), tương đương ') + run('{{contract.deposit_months_equiv}}') + run(' tháng tiền thuê.')))
  parts.push(paraRuns(run('Số người ở: ') + run('{{contract.occupant_count}}') + run('. Số xe đăng ký: ') + run('{{contract.vehicle_count}}') + run('.')))
  parts.push(paraRuns(run('Giá điện: ') + run('{{utilities.electricity_price_display}}')
    + run('. Giá nước: ') + run('{{utilities.water_price_display}}') + run(' / ') + run('{{utilities.water_unit}}') + run('.')))
  parts.push(para('Điều 2. Các dịch vụ kèm theo:', true))
  parts.push(loopTable('services', ['STT', 'Dịch vụ', 'Đơn giá (VNĐ)', 'Đơn vị', 'Ghi chú'],
    ['index', 'name', 'unit_price_display', 'unit_label', 'note'], [700, 3000, 2000, 1500, 2000]))
  parts.push(para('Số người, số xe tính phí được xác định theo thực tế hằng tháng và thể hiện trên hóa đơn.'))
  parts.push(paraRuns(run('Điều 3. Thanh toán từ ngày ') + run('{{payment.due_day_start}}')
    + run(' đến ngày ') + run('{{payment.due_day_end}}') + run(' hằng tháng. ') + run('{{payment.overdue_clause}}')))
  parts.push(paraRuns(run('Chuyển khoản: ') + run('{{payment.account_holder}}') + run(' - ')
    + run('{{payment.account_number}}') + run(' - ') + run('{{payment.bank_name}}')
    + run('. Nội dung: ') + run('{{payment.transfer_content}}')))
  parts.push(paraRuns(run('Điều 4. Phí người ở vượt: ') + run('{{terms.extra_occupant_fee_display}}')
    + run(' đồng. Phí khoan tường: ') + run('{{terms.drilling_fee_display}}')
    + run(' đồng. Phí làm lại vân tay: ') + run('{{terms.fingerprint_reset_fee_display}}') + run(' đồng.')))
  parts.push(paraRuns(run('Báo trước khi chấm dứt: ') + run('{{terms.notice_days}}')
    + run(' ngày. Hoàn cọc trong ') + run('{{terms.deposit_refund_days}}')
    + run(' ngày. Tự gia hạn: ') + run('{{terms.renewal_months}}') + run(' tháng.')))
  parts.push(para('Điều 5. Danh sách người ở:', true))
  parts.push(loopTable('occupants', ['STT', 'Họ tên', 'Ngày sinh', 'CMND/CCCD', 'Địa chỉ', 'Điện thoại'],
    ['index', 'full_name', 'date_of_birth', 'id_number', 'permanent_address', 'phone'], [700, 2500, 1500, 1800, 2500, 1500]))
  parts.push(para('Điều 6. Danh sách xe đăng ký:', true))
  parts.push(loopTable('vehicles', ['STT', 'Chủ xe', 'Biển số', 'Ghi chú'],
    ['index', 'owner_name', 'plate_number', 'note'], [700, 3000, 2500, 3000]))
  parts.push(paraRuns(run('Hợp đồng lập thành ') + run('{{contract.signed_copies}}')
    + run(' bản, mỗi bên giữ ') + run('{{contract.copies_per_party}}') + run(' bản.')))
  parts.push(paraRuns(run('BÊN CHO THUÊ') + run('                    ') + run('BÊN THUÊ')))
  // Appendix 1 — handover inventory
  parts.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`)
  parts.push(para('Phụ lục 1 — DANH SÁCH TÀI SẢN BÀN GIAO', true, 'center'))
  parts.push(paraRuns(run('Kèm theo Hợp đồng số ') + run('{{contract.number}}')))
  parts.push(loopTable('inventory', ['STT', 'Tên tài sản', 'SL', 'Tình trạng', 'Đơn giá (VNĐ)', 'Ghi chú'],
    ['index', 'name', 'quantity', 'condition_label', 'unit_value_display', 'note'], [700, 2800, 900, 1800, 2000, 2300]))
  parts.push(paraRuns(run('Tổng giá trị tham chiếu: ') + run('{{inventory_total_display}}') + run(' VNĐ')))
  parts.push(paraRuns(run('{{inventory_empty_text}}')))
  return parts.join('')
}

function appendixBody() {
  const parts = []
  parts.push(para('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', true, 'center'))
  parts.push(para('Độc lập - Tự do - Hạnh phúc', true, 'center'))
  parts.push(para('PHỤ LỤC HỢP ĐỒNG THUÊ PHÒNG', true, 'center'))
  parts.push(paraRuns(run('Số phụ lục: ') + run('{{appendix.number}}')))
  parts.push(paraRuns(run('Kèm theo Hợp đồng số ') + run('{{contract.number}}')))
  parts.push(paraRuns(run('Hôm nay, ') + run('{{appendix.signed_date_text}}') + run(', các Bên gồm:')))
  parts.push(PARTY_LINES('BÊN CHO THUÊ (Bên A):', 'lessor'))
  parts.push(PARTY_LINES('BÊN THUÊ (Bên B):', 'tenant'))
  parts.push(paraRuns(run('Điều 1. Nội dung điều chỉnh: ') + run('{{appendix.title}}')))
  parts.push(paraRuns(run('{{appendix.public_content}}')))
  parts.push(loopTable('changes', ['STT', 'Nội dung', 'Trước', 'Sau'],
    ['index', 'label', 'before', 'after'], [700, 3000, 2500, 3000]))
  parts.push(paraRuns(run('Điều 2. Hiệu lực: Phụ lục có hiệu lực từ ngày ') + run('{{appendix.effective_date}}')
    + run('. Các điều khoản khác của Hợp đồng giữ nguyên.')))
  parts.push(paraRuns(run('BÊN CHO THUÊ') + run('                    ') + run('BÊN THUÊ')))
  return parts.join('')
}

function buildDoc(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${DOC_OPEN}<w:body>${body}${SECT}</w:body></w:document>`
}

const CLEAN_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>'
const CLEAN_FOOTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>'

function writeTemplate(relPath, body) {
  const zip = new PizZip(readFileSync(resolve(process.cwd(), SOURCE)))
  zip.file('word/document.xml', buildDoc(body))
  // The original header/footer still carry docxtpl placeholders (e.g.
  // building.contact_phone). The renderer processes every XML part, so blank
  // them to clean WordprocessingML to avoid stray-tag render failures.
  for (const part of Object.keys(zip.files)) {
    if (/^word\/header\d*\.xml$/.test(part)) zip.file(part, CLEAN_HEADER)
    if (/^word\/footer\d*\.xml$/.test(part)) zip.file(part, CLEAN_FOOTER)
  }
  const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  const target = resolve(process.cwd(), OUT_DIR, relPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, out)
  console.warn('wrote', relPath, out.length, 'bytes')
}

writeTemplate('hop-dong-thue-phong/v1.docx', contractBody())
writeTemplate('phu-luc-hop-dong/v1.docx', appendixBody())
console.warn('done')
