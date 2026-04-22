export const useAuthStore = defineStore('auth', () => {
  const role = ref<string | null>(null)

  async function fetchRole() {
    if (role.value) return role.value
    const data = await $fetch<{ role?: string }>('/api/auth/me').catch(() => null)
    role.value = data?.role ?? null
    return role.value
  }

  function clearRole() {
    role.value = null
  }

  return { role, fetchRole, clearRole }
})
