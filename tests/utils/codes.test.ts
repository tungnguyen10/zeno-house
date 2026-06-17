import { describe, expect, it } from 'vitest'
import { buildingCodeFromSlug, nameInitialsFromFullName } from '../../app/utils/format/codes'

describe('buildingCodeFromSlug', () => {
  it('takes first char of each word', () => {
    expect(buildingCodeFromSlug('zeno-house-phu-nhuan')).toBe('zhpn')
  })

  it('single-word slug returns first char', () => {
    expect(buildingCodeFromSlug('zenith')).toBe('z')
  })

  it('is always lowercase', () => {
    expect(buildingCodeFromSlug('ABC-DEF')).toBe('ad')
  })

  it('filters empty segments from leading/trailing hyphens', () => {
    expect(buildingCodeFromSlug('-foo-bar-')).toBe('fb')
  })
})

describe('nameInitialsFromFullName', () => {
  it('strips Vietnamese diacritics and produces initials', () => {
    expect(nameInitialsFromFullName('Nguyễn Văn A')).toBe('nva')
  })

  it('handles đ/Đ correctly', () => {
    expect(nameInitialsFromFullName('Đặng Thị Hoa')).toBe('dth')
  })

  it('single-word name returns single initial', () => {
    expect(nameInitialsFromFullName('Minh')).toBe('m')
  })

  it('multiple spaces collapse correctly', () => {
    expect(nameInitialsFromFullName('Lê   Thị   Mai')).toBe('ltm')
  })
})
