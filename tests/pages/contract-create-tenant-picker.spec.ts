import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('tenant picker integration', () => {
  it('ContractForm uses TenantPicker and no longer preloads tenants', () => {
    const src = read('app/components/contracts/ContractForm.vue')
    expect(src).toContain('<TenantPicker')
    expect(src).not.toMatch(/useFetch<ApiSuccess<Tenant\[\]>>\('\/api\/tenants'/)
  })

  it('ContractOccupantForm uses TenantPicker and emits tenantName', () => {
    const src = read('app/components/contracts/ContractOccupantForm.vue')
    expect(src).toContain('<TenantPicker')
    expect(src).toContain('tenantName')
  })

  it('create page no longer preloads all tenants', () => {
    expect(read('app/pages/dashboard/contracts/create.vue')).not.toContain('allTenantsData')
  })
})
