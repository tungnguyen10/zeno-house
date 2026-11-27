export function usePortalConnection() {
  const online = ref(true)
  const reconnected = ref(false)
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function update() {
    const wasOnline = online.value
    online.value = navigator.onLine
    if (!wasOnline && online.value) {
      reconnected.value = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => { reconnected.value = false }, 6_000)
    }
    if (!online.value) reconnected.value = false
  }

  onMounted(() => {
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
    if (reconnectTimer) clearTimeout(reconnectTimer)
  })

  return { online, reconnected }
}
