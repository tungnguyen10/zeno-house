/** The visible viewport shrinks when a mobile keyboard opens, including on iOS. */
export function usePortalViewport() {
  const height = ref<number | null>(null)
  const bottom = ref(0)

  function update() {
    const viewport = window.visualViewport
    // Keep browser zoom available; do not resize the app while the user zooms.
    if (viewport && viewport.scale === 1) {
      height.value = Math.round(viewport.height)
      bottom.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
    }
    else {
      height.value = null
      bottom.value = 0
    }
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
  })
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  })

  return { height, bottom }
}
