import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/contracts/create.vue'), 'utf8')

describe('contract create — DOCX readiness integration', () => {
  it('checks DOCX readiness from room + tenant', () => {
    expect(page).toContain('checkContractDocumentReadiness')
    expect(page).toContain('docReadiness')
  })

  it('swaps the primary button on readiness and shows missing items', () => {
    expect(page).toContain('data-test="create-and-export"')
    expect(page).toContain("docReadiness?.ready !== false")
    expect(page).toContain('data-test="docx-missing"')
  })

  it('issues the document after a "Tạo & xuất DOCX" create', () => {
    expect(page).toContain('documentsApi.issue')
  })
})
