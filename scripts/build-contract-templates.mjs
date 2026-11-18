// Generator for versioned DOCX contract templates.
// Contract: the ORIGINAL public/templates/HOP_DONG_THUE_PHONG_TEMPLATE.docx is converted in
// place from docxtpl/Jinja to docxtemplater syntax ({{ }} delimiters), so styles, wording,
// header/footer and house rules stay identical to the original.
// Appendix: generated body on top of the same container. Re-run to regenerate v1 assets.
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

// docxtpl `{%tr for x in list %}` iterables -> data keys used by build-data.ts.
const LOOP_DATA_KEY = { occupants: 'occupants', vehicles: 'vehicles', inventory_items: 'inventory' }
const ROW_RE = /<w:tr[ >][\s\S]*?<\/w:tr>/g
const TEXT_RE = /(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g

// docxtemplater repeats a table row when {{#key}} and {{/key}} sit in the first and last cell.
function loopBodyRow(row, key) {
  const total = (row.match(/<w:t[ >]/g) || []).length
  let seen = 0
  return row.replace(TEXT_RE, (_m, open, text, close) => {
    seen++
    let next = text
    if (seen === 1) next = `{{#${key}}}${next}`
    if (seen === total) next = `${next}{{/${key}}}`
    return open + next + close
  })
}

function convertRowLoops(xml) {
  let key = null
  return xml.replace(ROW_RE, (row) => {
    const text = row.replace(/<[^>]+>/g, '')
    const start = text.match(/\{%tr for \w+ in (\w+) %\}/)
    if (start) {
      key = LOOP_DATA_KEY[start[1]]
      if (!key) throw new Error(`Unmapped loop source: ${start[1]}`)
      return ''
    }
    if (/\{%tr endfor %\}/.test(text)) {
      key = null
      return ''
    }
    return key ? loopBodyRow(row, key) : row
  })
}

function replaceOnce(xml, from, to) {
  if (!xml.includes(from)) throw new Error(`Template text not found: ${from.slice(0, 60)}`)
  return xml.replace(from, () => to)
}

// Normalizes docxtpl tags to the data model of build-data.ts.
function convertTags(xml) {
  let out = xml
    .replace(/\{\{\s*loop\.index\s*\}\}/g, '{{index}}')
    .replace(/\{\{\s*(?:person|vehicle)\.(\w+)\s*\}\}/g, '{{$1}}')
    .replace(/\{\{\s*item\.note\s*\}\}/g, '{{status_note}}')
    .replace(/\{\{\s*item\.(\w+)\s*\}\}/g, '{{$1}}')
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, '{{$1}}')
  out = replaceOnce(out, 'Đơn giá điện: {{services.electricity_price_display}} VNĐ/kWh.', 'Đơn giá điện: {{utilities.electricity_price_display}}.')
  out = replaceOnce(out, 'Đơn giá nước: {{services.water_price_display}} VNĐ/{{services.water_unit}}.', 'Đơn giá nước: {{utilities.water_price_display}}/{{utilities.water_unit}}.')
  // The management-fee line becomes one line per building service; the free-parking line is dropped.
  // paragraphLoop only repeats a paragraph when the loop tags sit in their own paragraphs.
  const textPara = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
  out = replaceOnce(out,
    textPara('- Đơn giá phí quản lý / dịch vụ ({{services.management_description}}): {{services.management_fee_display}} VNĐ/{{services.management_unit}}.'),
    textPara('{{#services}}')
    + textPara('- Đơn giá {{name}}: {{unit_price_display}} VNĐ/{{unit_label}}{{#note}} ({{note}}){{/note}}.')
    + textPara('{{/services}}'))
  const parking = /<w:p[ >](?:(?!<w:p[ >])[\s\S])*?\{\{parking\.free_slots\}\}[\s\S]*?<\/w:p>/
  if (!parking.test(out)) throw new Error('Parking paragraph not found')
  out = out.replace(parking, '')
  out = replaceOnce(out, 'Nếu sau ngày {{payment.overdue_day}} của tháng không đóng tiền', 'Nếu {{payment.overdue_trigger}} không đóng tiền')
  return out
}

// Print polish: layout only, contract wording stays as in the original.
const A4_SECTION = '<w:pgSz w:w="11906" w:h="16838"/>'
  + '<w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1588" w:header="567" w:footer="567" w:gutter="0"/>'
const PARTY_TAB = '<w:tabs><w:tab w:val="left" w:pos="5387"/></w:tabs>'
const TABLE_RE = /<w:tbl>[\s\S]*?<\/w:tbl>/g

function justifyBody(xml) {
  return xml.replace(/<w:p>(?!<w:pPr>)/g, '<w:p><w:pPr><w:jc w:val="both"/></w:pPr>')
    .replace(/<w:p><w:pPr>((?:(?!<\/w:pPr>)[\s\S])*?)<\/w:pPr>/g, (m, inner) =>
      /<w:jc |<w:br w:type="page"|<w:pStyle /.test(inner) ? m : `<w:p><w:pPr>${inner}<w:jc w:val="both"/></w:pPr>`)
}

function polishParties(xml) {
  return xml
    .replace(/<w:p><w:pPr><w:jc w:val="both"\/><\/w:pPr><w:r><w:t>(Ông\/bà: \{\{\w+\.full_name\}\}) +(Sinh ngày: \{\{\w+\.date_of_birth\}\})<\/w:t><\/w:r><\/w:p>/g,
      `<w:p><w:pPr>${PARTY_TAB}</w:pPr><w:r><w:t>$1</w:t><w:tab/><w:t>$2</w:t></w:r></w:p>`)
    .replace(/<w:p><w:pPr><w:jc w:val="both"\/><\/w:pPr><w:r><w:t>(CMND\/CCCD số: \{\{\w+\.id_number\}\}) +(Cấp ngày: \{\{\w+\.id_issued_date\}\}) +Tại: (\{\{\w+\.id_issued_place\}\})<\/w:t><\/w:r><\/w:p>/g,
      `<w:p><w:pPr>${PARTY_TAB}</w:pPr><w:r><w:t>$1</w:t><w:tab/><w:t>$2</w:t></w:r></w:p>`
      + '<w:p><w:r><w:t>Nơi cấp: $3</w:t></w:r></w:p>')
}

// National motto underlined per Vietnamese document convention; the "—oOo—" divider becomes redundant.
function polishMotto(xml) {
  return xml
    .replace(/<w:p><w:pPr><w:spacing w:after="\d+"\/><w:jc w:val="center"\/><\/w:pPr><w:r><w:rPr><w:b\/><\/w:rPr><w:t>Độc lập - Tự do - Hạnh phúc<\/w:t><\/w:r><\/w:p>/g,
      '<w:p><w:pPr><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r></w:p>')
    .replace(/<w:p><w:pPr><w:spacing w:after="\d+"\/><w:jc w:val="center"\/><\/w:pPr><w:r><w:t>—oOo—<\/w:t><\/w:r><\/w:p>/g, '')
}

// "- item" lines become a real "-" bullet list so wrapped lines align with the text in Word and the preview.
const DASH_NUM_ID = 90
const DASH_ABSTRACT = `<w:abstractNum w:abstractNumId="${DASH_NUM_ID}"><w:multiLevelType w:val="singleLevel"/>`
  + '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="-"/><w:lvlJc w:val="left"/>'
  + '<w:pPr><w:tabs><w:tab w:val="num" w:pos="284"/></w:tabs><w:ind w:left="284" w:hanging="284"/></w:pPr>'
  + '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>'

function polishDashLists(xml) {
  return xml
    .replace(/<w:p><w:pPr><w:jc w:val="both"\/><\/w:pPr><w:r><w:t>- ([^<]*)<\/w:t><\/w:r><\/w:p>/g,
      `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${DASH_NUM_ID}"/></w:numPr><w:jc w:val="both"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>`)
    .replace(/<w:r><w:t>(Căn cứ )/g, '<w:r><w:rPr><w:i/></w:rPr><w:t>$1')
    // Bank details read as an indented block under the payment clause.
    .replace(/<w:p><w:pPr><w:jc w:val="both"\/><\/w:pPr>(<w:r><w:t>(?:Người thụ hưởng|Số tài khoản|Ngân hàng|Nội dung chuyển khoản): )/g,
      '<w:p><w:pPr><w:spacing w:after="40"/><w:ind w:left="567"/><w:jc w:val="both"/></w:pPr>$1')
}

function polishNumbering(xml) {
  const firstNum = xml.indexOf('<w:num ')
  if (firstNum < 0) throw new Error('Numbering instances not found')
  return xml.slice(0, firstNum) + DASH_ABSTRACT + xml.slice(firstNum)
    .replace('</w:numbering>', `<w:num w:numId="${DASH_NUM_ID}"><w:abstractNumId w:val="${DASH_NUM_ID}"/></w:num></w:numbering>`)
}

function polishTables(xml) {
  return xml.replace(TABLE_RE, (tbl) => {
    let out = tbl.replace(/<w:tr>/g, '<w:tr><w:trPr><w:cantSplit/></w:trPr>')
      .replace(/<w:trPr><w:tblHeader w:val="true"\/><\/w:trPr>/g, '<w:trPr><w:cantSplit/><w:tblHeader w:val="true"/></w:trPr>')
    if (!/Ký và ghi rõ họ tên/.test(out)) {
      return out.replace(/<w:sz w:val="1[78]"\/>/g, '<w:sz w:val="22"/>').replace(/<w:r><w:t/g, '<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t')
    }
    // Signature block: larger titles, roomier signing space, bold printed name, kept with the clause above.
    out = out.replace(/<w:b\/><w:sz w:val="\d+"\/>/g, '<w:b/><w:sz w:val="26"/>')
      .replace(/<w:pPr><w:spacing w:after="20" w:before="20" w:line="252" w:lineRule="auto"\/>/g,
        '<w:pPr><w:keepNext/><w:spacing w:after="20" w:before="20" w:line="252" w:lineRule="auto"/>')
      .replace(/<w:b w:val="0"\/><w:sz w:val="20"\/><\/w:rPr><w:t>\(Ký và ghi rõ họ tên\)<\/w:t>(?:<w:br\/>)+<w:t>([^<]*)<\/w:t>/g,
        '<w:b w:val="0"/><w:i/><w:sz w:val="24"/></w:rPr><w:t>(Ký và ghi rõ họ tên)</w:t></w:r>'
        + '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>'
        + '<w:br/><w:br/><w:br/><w:br/><w:br/><w:t>$1</w:t>')
    return out
  })
}

function polishDocument(xml) {
  const sect = /<w:pgSz [^>]*\/><w:pgMar [^>]*\/>/
  if (!sect.test(xml)) throw new Error('Section page setup not found')
  const parts = xml.replace(sect, A4_SECTION).split(/(<w:tbl>[\s\S]*?<\/w:tbl>)/)
  const body = parts.map(part => (part.startsWith('<w:tbl>') ? part : polishDashLists(polishParties(justifyBody(polishMotto(part)))))).join('')
  return polishTables(body)
}

// 13pt body like Vietnamese administrative documents.
function polishStyles(xml) {
  return xml
    .replace(/(w:styleId="Normal">[\s\S]*?)<w:sz w:val="22"\/>/, '$1<w:sz w:val="26"/>')
    .replace(/(w:styleId="ContractHeading">[\s\S]*?)<w:sz w:val="23"\/>/, '$1<w:sz w:val="26"/>')
    .replace(/(w:styleId="ContractSubheading">[\s\S]*?)<w:sz w:val="22"\/>/, '$1<w:sz w:val="26"/>')
}

const LOGO_SOURCE = 'server/assets/invoice-email/zeno-logo.png'
const LOGO_HEIGHT_EMU = 288000

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

// Header: logo on the left, brand and contact phone right-aligned, thin rule underneath.
function logoHeader(logo) {
  const { width, height } = pngSize(logo)
  const cx = Math.round(LOGO_HEIGHT_EMU * width / height)
  const cy = LOGO_HEIGHT_EMU
  const drawing = '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/>`
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:nvPicPr><pic:cNvPr id="1" name="zeno-logo.png"/><pic:cNvPicPr/></pic:nvPicPr>'
    + '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
    + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'
  const text = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="505F62"/><w:sz w:val="18"/></w:rPr>'
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
    + '<w:p><w:pPr><w:pStyle w:val="Header"/>'
    + '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="AAB2BA"/></w:pBdr>'
    + '<w:tabs><w:tab w:val="clear" w:pos="4680"/><w:tab w:val="clear" w:pos="9360"/><w:tab w:val="right" w:pos="9184"/></w:tabs></w:pPr>'
    + `<w:r>${drawing}</w:r><w:r>${text}<w:tab/><w:t xml:space="preserve">{{building.brand_name}}   |   {{building.contact_phone}}</w:t></w:r>`
    + '</w:p></w:hdr>'
}

function addHeaderLogo(zip) {
  const logo = readFileSync(resolve(process.cwd(), LOGO_SOURCE))
  zip.file('word/media/zeno-logo.png', logo)
  zip.file('word/_rels/header1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/zeno-logo.png"/>'
    + '</Relationships>')
  const types = zip.file('[Content_Types].xml').asText()
  if (!types.includes('Extension="png"')) {
    zip.file('[Content_Types].xml', types.replace('<Default Extension="rels"', '<Default Extension="png" ContentType="image/png"/><Default Extension="rels"'))
  }
  zip.file('word/header1.xml', logoHeader(logo))
}

function polishFooter(xml) {
  const rpr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="18"/></w:rPr>'
  // Complex fields (not fldSimple) so both Word and the browser print preview show page numbers.
  const field = instr => `<w:r>${rpr}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rpr}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>`
    + `<w:r>${rpr}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${rpr}<w:t>1</w:t></w:r><w:r>${rpr}<w:fldChar w:fldCharType="end"/></w:r>`
  return replaceOnce(xml, '<w:fldSimple w:instr="PAGE"/>',
    `${field('PAGE')}<w:r>${rpr}<w:t xml:space="preserve"> / </w:t></w:r>${field('NUMPAGES')}`)
}

function writeContractTemplate(relPath) {
  const zip = new PizZip(readFileSync(resolve(process.cwd(), SOURCE)))
  zip.file('word/document.xml', polishDocument(convertTags(convertRowLoops(zip.file('word/document.xml').asText()))))
  zip.file('word/styles.xml', polishStyles(zip.file('word/styles.xml').asText()))
  zip.file('word/numbering.xml', polishNumbering(zip.file('word/numbering.xml').asText()))
  for (const part of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(part)) {
      const xml = zip.file(part).asText().replace(/\{\{\s*([\w.]+)\s*\}\}/g, '{{$1}}')
      zip.file(part, part.includes('footer') ? polishFooter(xml) : xml)
    }
  }
  addHeaderLogo(zip)
  const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  const target = resolve(process.cwd(), OUT_DIR, relPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, out)
  console.warn('wrote', relPath, out.length, 'bytes')
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

writeContractTemplate('hop-dong-thue-phong/v1.docx')
writeTemplate('phu-luc-hop-dong/v1.docx', appendixBody())
console.warn('done')
