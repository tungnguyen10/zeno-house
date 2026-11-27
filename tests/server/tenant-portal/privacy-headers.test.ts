import { describe, expect, it } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import handler from '../../../server/middleware/00.portal-privacy'

describe('portal response privacy', () => {
  it.each(['/portal', '/portal/profile', '/api/tenant/bootstrap', '/api/tenant/contract-documents/doc/download?x=1'])('does not allow caching %s', async (path) => {
    const req = new IncomingMessage(new Socket())
    req.url = path
    const res = new ServerResponse(req)
    await handler(createEvent(req, res))
    expect(res.getHeader('Cache-Control')).toBe('private, no-store, max-age=0')
    expect(res.getHeader('Pragma')).toBe('no-cache')
  })

  it.each(['/offline', '/_nuxt/app.js', '/api/tenant-accounts'])('does not override other cache policies on %s', async (path) => {
    const req = new IncomingMessage(new Socket())
    req.url = path
    const res = new ServerResponse(req)
    await handler(createEvent(req, res))
    expect(res.getHeader('Cache-Control')).toBeUndefined()
  })
})
