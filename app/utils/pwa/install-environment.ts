export interface PwaNavigatorSnapshot {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

export interface PwaInstallEnvironment {
  isAppleMobile: boolean
  isSafari: boolean
}

const IOS_DEVICE_PATTERN = /iphone|ipad|ipod/i
const NON_SAFARI_IOS_BROWSER_PATTERN = /crios|fxios|edgios|opios|duckduckgo|gsa/i

export function detectPwaInstallEnvironment(
  navigatorSnapshot: PwaNavigatorSnapshot,
): PwaInstallEnvironment {
  const { userAgent, platform = '', maxTouchPoints = 0 } = navigatorSnapshot
  const isDesktopClassIpad = platform === 'MacIntel' && maxTouchPoints > 1
  const isAppleMobile = IOS_DEVICE_PATTERN.test(userAgent) || isDesktopClassIpad
  const isSafari = /safari/i.test(userAgent) && !NON_SAFARI_IOS_BROWSER_PATTERN.test(userAgent)

  return { isAppleMobile, isSafari }
}
