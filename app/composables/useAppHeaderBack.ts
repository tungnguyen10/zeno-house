/**
 * Shared back-navigation target for the sticky admin header (mobile only).
 * `UiPageHeader` sets this from its `backTo` prop; `AppHeader` reads it to
 * render a contextual back button in place of the empty mobile spacer.
 */
import type { RouteLocationRaw } from 'vue-router'

export function useAppHeaderBack() {
  return useState<RouteLocationRaw | null>('app-header-back', () => null)
}
