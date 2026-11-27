import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function filesIn(dir: string): string[] {
  return readdirSync(resolve(dir))
    .map(f => join(dir, f))
    .filter(f => statSync(resolve(f)).isFile())
}

const SETTINGS_FILES = [
  ...filesIn('app/pages/dashboard/settings'),
  'app/pages/dashboard/settings.vue',
  'app/components/app/AppSettingsNav.vue',
  ...filesIn('app/components/users'),
  'app/utils/users/display.ts',
  'app/utils/constants/navigation.ts',
]

describe('settings terminology', () => {
  it.each(SETTINGS_FILES)('%s uses xoá, khoá, huỷ and tòa nhà', (file) => {
    expect(readFileSync(resolve(file), 'utf8')).not.toMatch(/[Xx]óa|[Kk]hóa|[Hh]ủy|[Tt]oà nhà|[Hh]óa đơn|hiệu hóa/)
  })
})
