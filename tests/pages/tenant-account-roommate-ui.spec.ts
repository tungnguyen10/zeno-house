import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/dashboard/settings/tenant-accounts.vue'), 'utf8')

describe('tenant account provisioning roommate context', () => {
  it('shows assignment role, room and primary tenant while choosing an account target', () => {
    expect(page).toContain('tenant.activeAssignment')
    expect(page).toContain("tenant.activeAssignment.assignmentRole === 'roommate'")
    expect(page).toContain('Người ở cùng')
    expect(page).toContain('tenant.activeAssignment.roomNumber')
    expect(page).toContain('tenant.activeAssignment.primaryTenantName')
  })
})
