export type ApiNamespace = 'internal' | 'portal'

export function classifyApiNamespace(path: string): ApiNamespace | null {
  if (path === '/api/portal' || path.startsWith('/api/portal/')) return 'portal'
  if (path === '/api' || path.startsWith('/api/')) return 'internal'
  return null
}
