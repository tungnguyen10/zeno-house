export type ApiNamespace = 'internal' | 'tenant'

export function classifyApiNamespace(path: string): ApiNamespace | null {
  const queryIndex = path.indexOf('?')
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex)

  if (pathname === '/api/tenant' || pathname.startsWith('/api/tenant/')) return 'tenant'
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'internal'
  return null
}
