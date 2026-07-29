import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/profile.vue'), 'utf8')

describe('portal profile refreshed UI', () => {
  it('uses the shared page rhythm, type roles, and matching skeletons', () => {
    expect(page).toContain('space-y-5 px-4 py-5')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-body')
    expect(page).toContain('variant="statement"')
    expect(page).toContain('variant="card"')
  })

  it('separates a read-only view state from an inline edit state', () => {
    expect(page).toContain('mode === \'view\'')
    expect(page).toContain('@click="openEdit"')
    expect(page).toContain('@click="cancelEdit"')
    expect(page).toContain('@submit.prevent="onSave"')
  })

  it('routes self-service fields through PortalInput while keeping login and legal identity read-only', () => {
    expect(page.match(/<PortalInput/g)).toHaveLength(8)
    expect(page).not.toContain('v-model="form.email"')
    expect(page).not.toContain('v-model="form.id_number"')
    expect(page).not.toContain('v-model="form.id_issued_date"')
    expect(page).not.toContain('v-model="form.id_issued_place"')
    expect(page).toContain('Thông tin định danh do ban quản lý xác minh')
    expect(page.match(/<input/g)).toHaveLength(1)
    expect(page).toContain('type="file"')
  })

  it('offers gender as an accessible segmented control', () => {
    expect(page).toContain('GENDER_OPTIONS')
    expect(page).toContain(':aria-pressed="form.gender === option.value"')
  })

  it('uses semantic upload progress without inline presentation styles', () => {
    expect(page).toContain('<progress')
    expect(page).not.toContain(':style=')
  })

  it('keeps document removal and logout keyboard-visible', () => {
    expect(page).toContain('aria-label="Xóa tài liệu"')
    expect(page).toContain('focus-visible:ring-2')
    expect(page).toContain('<PortalButton variant="secondary" block @click="onLogout">')
  })
})
