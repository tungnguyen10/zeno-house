import { classifyApiNamespace } from '../utils/api-namespace'

export default defineEventHandler((event) => {
  const apiNamespace = classifyApiNamespace(event.path)
  if (!apiNamespace) return

  // Classification only for now. The tenant-role change will enforce the
  // role-to-API namespace matrix at this seam.
  event.context.apiNamespace = apiNamespace
})
