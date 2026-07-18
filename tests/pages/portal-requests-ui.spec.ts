import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/requests.vue'), 'utf8')

describe('portal requests refreshed UI', () => {
  it('uses the shared page rhythm, list status badge, and card skeletons', () => {
    expect(page).toContain('px-4 py-5 lg:px-8 lg:py-8')
    expect(page).toContain('<PortalStatusBadge :status="request.status" />')
    expect(page).toContain('variant="card"')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-caption')
  })

  it('routes text and multiline fields through PortalTextField with unified errors', () => {
    expect(page.match(/<PortalTextField/g)).toHaveLength(2)
    expect(page).toContain(':error="formErrors.title"')
    expect(page).toContain(':error="formErrors.description"')
    expect(page.match(/<input/g)).toHaveLength(1)
    expect(page).toContain('type="file"')
  })

  it('gives the attachment field a visible focus and error relationship', () => {
    expect(page).toContain('focus-within:ring-2')
    expect(page).toContain(':aria-describedby="attachmentError ? \'request-attachment-error\' : undefined"')
    expect(page).toContain('id="request-attachment-error"')
  })
})
