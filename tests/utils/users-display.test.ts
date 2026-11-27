import { describe, expect, it } from 'vitest'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

describe('userInitials', () => {
  it.each([
    ['Bùi Văn Linh', null, 'BL'],
    ['Nguyễn Tùng Dương', 'x@y.z', 'ND'],
    ['Minh', null, 'MI'],
    ['  ', 'tuananh@gmail.com', 'TU'],
    [null, null, '?'],
  ])('%s / %s → %s', (name, email, expected) => {
    expect(userInitials(name, email)).toBe(expected)
  })
})

describe('managedRoleLabel', () => {
  it('uses product terms', () => {
    expect(managedRoleLabel('owner')).toBe('Chủ nhà')
    expect(managedRoleLabel('manager')).toBe('Quản lý')
    expect(managedRoleLabel('admin')).toBe('Quản trị viên')
    expect(managedRoleLabel(null)).toBe('—')
  })
})
