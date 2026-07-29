import type { DeepReadonly, Ref } from 'vue'
import { nextTick, onMounted, readonly, ref, shallowRef, watch } from 'vue'
import { usePortalTheme } from './usePortalTheme'

export interface PortalChartPalette {
  accent: string
  accentSoft: string
  positive: string
  border: string
  surfaceDeep: string
  title: string
  body: string
  muted: string
}

const TRANSPARENT_PALETTE: PortalChartPalette = {
  accent: 'transparent',
  accentSoft: 'transparent',
  positive: 'transparent',
  border: 'transparent',
  surfaceDeep: 'transparent',
  title: 'transparent',
  body: 'transparent',
  muted: 'transparent',
}

function reducedMotionDuration(): number {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 220
}

export function usePortalChartTheme(): {
  palette: DeepReadonly<Ref<PortalChartPalette>>
  animationDuration: DeepReadonly<Ref<number>>
  refresh: () => void
} {
  const { resolvedTheme } = usePortalTheme()
  const palette = shallowRef<PortalChartPalette>({ ...TRANSPARENT_PALETTE })
  const animationDuration = ref(reducedMotionDuration())

  function refresh() {
    if (typeof document === 'undefined') return

    const shell = document.querySelector<HTMLElement>('.portal-shell')
    if (!shell) return

    const styles = getComputedStyle(shell)
    const read = (name: string) =>
      styles.getPropertyValue(name).trim() || 'transparent'

    palette.value = {
      accent: read('--portal-accent'),
      accentSoft: read('--portal-accent-soft'),
      positive: read('--portal-positive'),
      border: read('--portal-border'),
      surfaceDeep: read('--portal-surface-deep'),
      title: read('--portal-title'),
      body: read('--portal-body'),
      muted: read('--portal-muted'),
    }
  }

  onMounted(refresh)
  watch(resolvedTheme, async () => {
    await nextTick()
    refresh()
  })

  return {
    palette: readonly(palette),
    animationDuration: readonly(animationDuration),
    refresh,
  }
}
