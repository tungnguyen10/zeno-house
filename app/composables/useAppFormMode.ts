/**
 * Set while a full-page form owns the bottom of the mobile viewport, so the app
 * tab bar steps aside for the form's docked action bar (mirrors useAppHeaderBack).
 */
export function useAppFormMode() {
  return useState<boolean>('app-form-mode', () => false)
}
