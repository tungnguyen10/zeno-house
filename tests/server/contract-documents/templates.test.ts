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

  it('contract template keeps the original articles, house rules and appendix, with building-service and table loops', () => {
    const text = documentText(CONTRACT_TEMPLATES['hop-dong-thue-phong'].file)
    expect(text).not.toContain('parking.free_slots')
    expect(text).toContain('{{#services}}')
    expect(text).toContain('{{#inventory}}')
    expect(text).toContain('{{#vehicles}}')
    expect(text).toContain('{{#occupants}}')
    for (const marker of ['Điều 1:', 'Điều 8:', '8.7.', 'NỘI QUY', '16. Việc ra vào', 'PHỤ LỤC 01']) {
      expect(text).toContain(marker)
    }
  })
})
