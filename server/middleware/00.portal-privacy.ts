import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? ''
  if (path !== '/portal' && !path.startsWith('/portal/')
    && path !== '/api/tenant' && !path.startsWith('/api/tenant/')) return

  // Covers error responses too: neither a shared proxy nor the HTTP cache may
  // retain a tenant payload, authenticated HTML or a short-lived signed link.
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
})
