import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const page = read('app/pages/dashboard/buildings/[id]/index.vue')
const strip = existsSync(resolve(process.cwd(), 'app/components/buildings/BuildingSetupStrip.vue'))
  ? read('app/components/buildings/BuildingSetupStrip.vue')
  : ''

describe('building detail setup and cleanup', () => {
  it('replaces the readiness card with the setup strip', () => {
    expect(existsSync(resolve(process.cwd(), 'app/components/buildings/BuildingReadinessCard.vue'))).toBe(false)
    expect(page).toContain('<BuildingSetupStrip')
    expect(strip).toContain('summarizeRequiredSteps(')
    expect(strip).toContain('Tiếp tục thiết lập')
  })

  it('does not nest a button inside a link in the strip', () => {
    expect(strip).not.toMatch(/<NuxtLink[^>]*>\s*<UiButton/)
  })

  it('header actions are Thêm phòng and Cài đặt only', () => {
    expect(page).toContain('>Cài đặt<')
    expect(page).not.toContain('>Chỉnh sửa<')
    expect(page).not.toMatch(/>\s*Dịch vụ\s*</)
  })

  it('shows lessor contact instead of owner contact and does not repeat address or description', () => {
    expect(page).toContain('label="Bên cho thuê"')
    expect(page).not.toContain('ownerName')
    expect(page).not.toContain('label="Địa chỉ" :value="building.address"')
    expect(page).not.toContain('label="Mô tả"')
  })

  it('hero no longer repeats the building name', () => {
    expect(read('app/components/buildings/BuildingDetailHero.vue')).not.toContain('{{ building.name }}')
  })
})
