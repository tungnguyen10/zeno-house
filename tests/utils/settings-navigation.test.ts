import { describe, expect, it } from 'vitest'
import { getSettingsNavGroups } from '~/utils/constants/navigation'

const keysFor = (role: 'admin' | 'owner' | 'manager') =>
  getSettingsNavGroups({ isAdmin: role === 'admin', role })
    .map(group => [group.key, group.items.map(item => item.key)])

describe('getSettingsNavGroups', () => {
  it('gives admin every group and item in order', () => {
    expect(keysFor('admin')).toEqual([
      ['personal', ['profile', 'security']],
      ['administration', ['users', 'tenant-accounts', 'access-requests', 'building-visibility', 'history']],
      ['buildings', ['building-settings']],
    ])
  })

  it('limits owner administration to users and tenant accounts', () => {
    expect(keysFor('owner')).toEqual([
      ['personal', ['profile', 'security']],
      ['administration', ['users', 'tenant-accounts']],
      ['buildings', ['building-settings']],
    ])
  })

  it('drops the empty administration group for manager', () => {
    expect(keysFor('manager')).toEqual([
      ['personal', ['profile', 'security']],
      ['buildings', ['building-settings']],
    ])
  })

  it('shows nothing role-gated when the role is unknown', () => {
    const groups = getSettingsNavGroups({ isAdmin: false, role: null })
    expect(groups.map(group => group.key)).toEqual(['personal', 'buildings'])
  })

  it('points every item at a settings route and uses the tòa spelling', () => {
    const items = getSettingsNavGroups({ isAdmin: true, role: 'admin' }).flatMap(group => group.items)
    expect(items.every(item => item.to.startsWith('/dashboard/settings/'))).toBe(true)
    expect(items.map(item => item.label).join('|')).not.toMatch(/[Tt]oà nhà/)
  })
})
