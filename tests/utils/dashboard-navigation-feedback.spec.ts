import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDashboardNavigationFeedback } from '~/utils/dashboard-navigation-feedback'

afterEach(() => vi.useRealTimers())

describe('dashboard navigation feedback', () => {
  it('keeps the activated source pending until the destination renders', () => {
    vi.useFakeTimers()
    const feedback = createDashboardNavigationFeedback()

    expect(feedback.begin('billing-row', '/dashboard/billing/a/2026-10', '/dashboard/billing')).toBe(true)
    expect(feedback.isPending('billing-row')).toBe(true)
    expect(feedback.showSpinner('billing-row')).toBe(false)
    vi.advanceTimersByTime(120)
    expect(feedback.showSpinner('billing-row')).toBe(true)

    feedback.pageRendered('/dashboard/billing/a/2026-10')
    expect(feedback.isPending('billing-row')).toBe(false)
  })

  it('ignores duplicate activation and lets a newer destination take over', () => {
    const feedback = createDashboardNavigationFeedback()
    expect(feedback.begin('row-a', '/dashboard/tenants/a', '/dashboard/tenants')).toBe(true)
    expect(feedback.begin('row-a', '/dashboard/tenants/a', '/dashboard/tenants')).toBe(false)
    expect(feedback.begin('row-b', '/dashboard/tenants/b', '/dashboard/tenants')).toBe(true)

    feedback.pageRendered('/dashboard/tenants/a')
    expect(feedback.isPending('row-b')).toBe(true)
    feedback.navigationFailed('/dashboard/tenants/a')
    expect(feedback.isPending('row-b')).toBe(true)
    feedback.navigationFailed('/dashboard/tenants/b')
    expect(feedback.isPending('row-b')).toBe(false)
  })

  it('does not show pending state for the current destination', () => {
    const feedback = createDashboardNavigationFeedback()
    expect(feedback.begin('tab', '/dashboard', '/dashboard')).toBe(false)
    expect(feedback.isPending('tab')).toBe(false)
  })

  it('keeps feedback through a redirect until the final page renders', () => {
    const feedback = createDashboardNavigationFeedback()
    feedback.begin('row', '/dashboard/rooms/old', '/dashboard/rooms')
    feedback.redirected('/dashboard/rooms/old', '/dashboard/rooms/new')

    feedback.pageRendered('/dashboard/rooms/old')
    expect(feedback.isPending('row')).toBe(true)
    feedback.pageRendered('/dashboard/rooms/new')
    expect(feedback.isPending('row')).toBe(false)
  })
})
