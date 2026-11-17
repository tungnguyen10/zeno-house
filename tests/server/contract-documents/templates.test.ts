import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { CONTRACT_TEMPLATES } from '../../../server/assets/contract-templates/manifest'

function documentText(file: string): string {
  const zip = new PizZip(readFileSync(resolve(process.cwd(), 'server/assets/contract-templates', file)))
  const xml = zip.file('word/document.xml')!.asText()
  return xml.replace(/<[^>]+>/g, '')
}

describe('contract templates', () => {
  for (const entry of Object.values(CONTRACT_TEMPLATES)) {
    it(`${entry.key} v${entry.version} has no docxtpl syntax and contains required paths`, () => {
      const text = documentText(entry.file)
      expect(text).not.toContain('{%')
      expect(text).not.toContain('loop.index')
      for (const path of entry.requiredPaths) expect(text).toContain(`{{${path}}}`)
    })
  }

  it('contract template keeps the original articles, house rules and appendix, with service/inventory tables', () => {
    const text = documentText(CONTRACT_TEMPLATES['hop-dong-thue-phong'].file)
    expect(text).not.toContain('parking.free_slots')
    expect(text).not.toContain('management_fee')
    expect(text).toContain('{{#services}}')
    expect(text).toContain('{{#inventory}}')
    expect(text).toContain('{{#vehicles}}')
    expect(text).toContain('{{#occupants}}')
    for (const marker of [
      'Căn cứ Bộ luật Dân sự số 91/2015/QH13', 'Điều 1: Phòng ở', 'Điều 2: Thời hạn thuê', 'Điều 3: Tiền thuê phòng',
      'Điều 4: Đặt cọc', 'Điều 5: Quyền và nghĩa vụ của bên cho thuê', 'Điều 6: Quyền và nghĩa vụ của bên thuê',
      'Điều 7: Chấm dứt hợp đồng', 'Điều 8: Điều khoản thi hành', 'NỘI QUY', '16. Việc ra vào và khóa cửa bằng vân tay',
      'PHỤ LỤC 01 — DANH MỤC TÀI SẢN BÀN GIAO',
    ]) expect(text, marker).toContain(marker)
  })

  it('prints the handover meter readings under the appendix handover date', () => {
    const text = documentText(CONTRACT_TEMPLATES['hop-dong-thue-phong'].file)
    expect(text).toContain('Chỉ số điện khi bàn giao: {{handover.electricity_display}}')
    expect(text).toContain('Chỉ số nước khi bàn giao: {{handover.water_display}}')
    expect(text.indexOf('Ngày bàn giao: {{contract.handover_date}}')).toBeLessThan(text.indexOf('{{handover.electricity_display}}'))
  })

  it('contract template keeps the original header and footer', () => {
    const zip = new PizZip(readFileSync(resolve(process.cwd(), 'server/assets/contract-templates', CONTRACT_TEMPLATES['hop-dong-thue-phong'].file)))
    const header = zip.file('word/header1.xml')!.asText().replace(/<[^>]+>/g, '')
    expect(header).toContain('{{building.brand_name}}')
    expect(header).toContain('{{building.contact_phone}}')
    expect(zip.file('word/footer1.xml')!.asText().replace(/<[^>]+>/g, '')).toContain('Trang')
  })
})
