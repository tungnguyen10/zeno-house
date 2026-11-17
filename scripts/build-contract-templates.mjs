// One-off generator for versioned DOCX contract templates (PR4b Task 3).
// The contract template is the original HOP_DONG_THUE_PHONG_TEMPLATE.docx converted in place
// from docxtpl to docxtemplater syntax ({{ }} delimiters), so every article, the house rules,
// header/footer and formatting stay as authored. The appendix body is generated on the same
// container. Re-run to regenerate v1 assets.
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

const TR = '<w:tr>(?:(?!<w:tr>|</w:tr>).)*?'
// Paragraph (not <w:pPr>) containing `needle`.
const paragraphWith = needle => new RegExp(`<w:p(?: [^>]*)?>(?:(?!<w:p[ >]|</w:p>).)*?${needle}(?:(?!</w:p>).)*</w:p>`, 's')

// Same table look as the tables of the original template (grey header, light borders).
const STYLED_RPR = size => `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${size === 18 ? '<w:b/>' : '<w:b w:val="0"/>'}<w:sz w:val="${size}"/></w:rPr>`
function styledCell(text, width, { header, align }) {
  const shd = header ? '<w:shd w:fill="F0F2F3"/>' : ''
  const mar = '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:start w:w="80" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:end w:w="80" w:type="dxa"/></w:tcMar>'
  const ppr = `<w:pPr><w:spacing w:after="20" w:before="20" w:line="252" w:lineRule="auto"/><w:jc w:val="${align}"/></w:pPr>`
  return `<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="${width}"/>${shd}${mar}<w:vAlign w:val="center"/></w:tcPr>`
    + `<w:p>${ppr}<w:r>${STYLED_RPR(header ? 18 : 17)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`
}
function styledLoopTable(key, headers, fields, widths) {
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(s => `<w:${s} w:val="single" w:sz="5" w:color="AAB2BA"/>`).join('')
  const head = `<w:tr><w:trPr><w:tblHeader w:val="true"/></w:trPr>${headers.map((h, i) => styledCell(h, widths[i], { header: true, align: 'center' })).join('')}</w:tr>`
  const body = `<w:tr>${fields.map((f, i) => {
    let text = `{{${f}}}`
    if (i === 0) text = `{{#${key}}}${text}`
    if (i === fields.length - 1) text = `${text}{{/${key}}}`
    return styledCell(text, widths[i], { header: false, align: i === 0 ? 'center' : 'left' })
  }).join('')}</w:tr>`
  return '<w:tbl><w:tblPr><w:tblW w:type="auto" w:w="0"/><w:jc w:val="center"/>'
    + `<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${head}${body}</w:tbl>`
}

// docxtpl row loops ({%tr for … %} row, data row, {%tr endfor %} row) -> docxtemplater
// loop opened in the first and closed in the last cell of the data row.
function convertRowLoop(xml, { item, source, key, fields }) {
  const re = new RegExp(`${TR}\\{%tr for ${item} in ${source} %\\}(?:(?!</w:tr>).)*</w:tr>(<w:tr>(?:(?!</w:tr>).)*</w:tr>)${TR}\\{%tr endfor %\\}(?:(?!</w:tr>).)*</w:tr>`, 's')
  if (!re.test(xml)) throw new Error(`loop not found: ${source}`)
  return xml.replace(re, (_all, dataRow) => {
    let row = dataRow.replace(/\{\{\s*loop\.index\s*\}\}/, '{{index}}')
    for (const [from, to] of Object.entries(fields)) row = row.replace(new RegExp(`\\{\\{\\s*${item}\\.${from}\\s*\\}\\}`), `{{${to}}}`)
    row = row.replace(/(<w:t(?: [^>]*)?>)/, `$1{{#${key}}}`)
    const last = row.lastIndexOf('</w:t>')
    return `${row.slice(0, last)}{{/${key}}}${row.slice(last)}`
  })
}

// The original lists a management-fee line and a "free N vehicles" line. Per the accepted
// design they become a services table (actual contract services) plus a billing note.
function replaceServiceLines(xml) {
  const subheading = '<w:p><w:pPr><w:pStyle w:val="ContractSubheading"/></w:pPr><w:r><w:t>Danh sách dịch vụ áp dụng</w:t></w:r></w:p>'
  const table = styledLoopTable('services', ['STT', 'Dịch vụ', 'Đơn giá (VNĐ)', 'Đơn vị', 'Ghi chú'],
    ['index', 'name', 'unit_price_display', 'unit_label', 'note'], [518, 3300, 1700, 1500, 2918])
  const note = '<w:p><w:r><w:t>- Số người, số xe tính phí được xác định theo thực tế hằng tháng và thể hiện trên hóa đơn.</w:t></w:r></w:p>'
  const management = paragraphWith('services\\.management_description')
  const parking = paragraphWith('parking\\.free_slots')
  if (!management.test(xml) || !parking.test(xml)) throw new Error('management/parking lines not found')
  return xml.replace(management, () => `${subheading}${table}${note}`).replace(parking, '')
}

// Handover meter readings are printed in the appendix next to the handover date, so the
// original articles stay untouched.
function addHandoverReadings(xml) {
  const dateLine = paragraphWith('Ngày bàn giao: \\{\\{ contract\\.handover_date \\}\\}')
  if (!dateLine.test(xml)) throw new Error('handover date line not found')
  const line = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
  return xml.replace(dateLine, found => `${found}${line('Chỉ số điện khi bàn giao: {{ handover.electricity_display }}')}${line('Chỉ số nước khi bàn giao: {{ handover.water_display }}')}`)
}

// `{{ a.b }}` -> `{{a.b}}` so the manifest paths match the document text literally.
function normalizeTags(xml) {
  return xml.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, '{{$1}}')
}

function convertContractXml(source) {
  let xml = source
  xml = convertRowLoop(xml, { item: 'person', source: 'occupants', key: 'occupants', fields: { full_name: 'full_name', date_of_birth: 'date_of_birth', id_number: 'id_number', permanent_address: 'permanent_address', phone: 'phone' } })
  xml = convertRowLoop(xml, { item: 'vehicle', source: 'vehicles', key: 'vehicles', fields: { owner_name: 'owner_name', plate_number: 'plate_number', note: 'note' } })
  xml = convertRowLoop(xml, { item: 'item', source: 'inventory_items', key: 'inventory', fields: { name: 'name_display', value_display: 'value_display', note: 'note_display' } })
  xml = replaceServiceLines(xml)
  xml = addHandoverReadings(xml)
  xml = xml
    .replace('{{ services.electricity_price_display }} VNĐ/kWh', '{{ utilities.electricity_price_display }}')
    .replace('{{ services.water_price_display }}', '{{ utilities.water_price_display }}')
    .replace('{{ services.water_unit }}', '{{ utilities.water_unit }}')
    .replace('Nếu sau ngày {{ payment.overdue_day }} của tháng không đóng tiền,', '{{ payment.overdue_clause }}')
  return normalizeTags(xml)
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

function writeTemplate(relPath, build) {
  const zip = new PizZip(readFileSync(resolve(process.cwd(), SOURCE)))
  build(zip)
  const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  const target = resolve(process.cwd(), OUT_DIR, relPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, out)
  console.warn('wrote', relPath, out.length, 'bytes')
}

writeTemplate('hop-dong-thue-phong/v1.docx', (zip) => {
  zip.file('word/document.xml', convertContractXml(zip.file('word/document.xml').asText()))
  for (const part of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(part)) zip.file(part, normalizeTags(zip.file(part).asText()))
  }
})

writeTemplate('phu-luc-hop-dong/v1.docx', (zip) => {
  zip.file('word/document.xml', buildDoc(appendixBody()))
  // The appendix body has no header/footer references; blank the original parts.
  for (const part of Object.keys(zip.files)) {
    if (/^word\/header\d*\.xml$/.test(part)) zip.file(part, CLEAN_HEADER)
    if (/^word\/footer\d*\.xml$/.test(part)) zip.file(part, CLEAN_FOOTER)
  }
})
console.warn('done')
