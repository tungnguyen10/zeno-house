/**
 * Shared center-title slot for the sticky mobile app header (mirrors useAppHeaderBack).
 * Pages opt in by setting this ref (e.g. once their own large title scrolls out of view).
 */
export function useAppHeaderTitle() {
  return useState<string | null>('app-header-title', () => null)
}
