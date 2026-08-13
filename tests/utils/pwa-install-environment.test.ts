import { describe, expect, it } from 'vitest'
import { detectPwaInstallEnvironment } from '~/utils/pwa/install-environment'

describe('detectPwaInstallEnvironment', () => {
  it('recognizes iPhone Safari', () => {
    expect(detectPwaInstallEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })).toEqual({ isAppleMobile: true, isSafari: true })
  })

  it('recognizes iPadOS when Safari presents a desktop Mac user agent', () => {
    expect(detectPwaInstallEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toEqual({ isAppleMobile: true, isSafari: true })
  })

  it('keeps third-party iOS browsers on the Apple manual-install path without calling them Safari', () => {
    expect(detectPwaInstallEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })).toEqual({ isAppleMobile: true, isSafari: false })
  })

  it('does not mistake a touch-capable Mac for iPadOS', () => {
    expect(detectPwaInstallEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })).toEqual({ isAppleMobile: false, isSafari: true })
  })
})
