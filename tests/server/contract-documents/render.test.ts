import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { renderDocx } from '../../../server/services/contract-documents/render'
import { contractDocumentFixture } from '../../__fixtures__/contract-document-data'

const template = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates/hop-dong-thue-phong/v1.docx'))
const textOf = (buf: Buffer) => new PizZip(buf).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '')

describe('renderDocx', () => {
  it('renders all placeholders and loops', () => {
    const out = renderDocx(template, contractDocumentFixture())
    const text = textOf(out)
    expect(text).not.toMatch(/\{\{|\}\}/)
    expect(text).toContain('Người Thuê Giả Lập')
    expect(text).toContain('59X1 123.45')
    expect(text).toContain('Giường đơn')
    expect(text).toContain('Ba triệu đồng')
  })

  it('throws on missing data without leaking values', () => {
    const data = contractDocumentFixture()
    delete (data.tenant as Record<string, unknown>).id_issued_place
    expect(() => renderDocx(template, data)).toThrowError(/tenant\.id_issued_place/)
  })
})
