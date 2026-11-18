import { describe, expect, it } from 'vitest'
import { evaluateSmoke } from '../../scripts/tenant-linking-smoke.mjs'

const body = (code: string) => ({ data: undefined, error: { code, message: 'x' } })

describe('tenant linking smoke evaluation', () => {
  it('passes when every spoof is rejected and the failure bodies are identical', () => {
    const results = evaluateSmoke({
      anonymousVerify: { status: 401, json: body('UNAUTHENTICATED') },
      spoofCreate: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      spoofOccupant: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      unknownPhone: { status: 404, json: body('TENANT_LINK_UNVERIFIED') },
      wrongProof: { status: 404, json: body('TENANT_LINK_UNVERIFIED') },
    })
    expect(results.every(r => r.ok)).toBe(true)
    expect(results).toHaveLength(5)
  })

  it('fails loudly when a spoofed create is accepted', () => {
    const results = evaluateSmoke({
      anonymousVerify: { status: 401, json: body('UNAUTHENTICATED') },
      spoofCreate: { status: 201, json: { data: { id: 'c-1' } } },
      spoofOccupant: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      unknownPhone: { status: 404, json: body('TENANT_LINK_UNVERIFIED') },
      wrongProof: { status: 404, json: body('TENANT_LINK_UNVERIFIED') },
    })
    const failed = results.filter(r => !r.ok)
    expect(failed.map(r => r.name)).toEqual([
      expect.stringMatching(/spoofed create with an out-of-scope/i),
      expect.stringMatching(/did not create a contract/i),
    ])
    expect(failed[1]!.detail).toContain('CREATED c-1')
  })

  it('fails when unknown phone and wrong proof are distinguishable', () => {
    const results = evaluateSmoke({
      anonymousVerify: { status: 401, json: body('UNAUTHENTICATED') },
      spoofCreate: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      spoofOccupant: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      unknownPhone: { status: 404, json: body('TENANT_LINK_UNVERIFIED') },
      wrongProof: { status: 409, json: body('TENANT_BUSY') },
    })
    expect(results.find(r => /indistinguishable/i.test(r.name))!.ok).toBe(false)
  })

  it('treats a disabled feature (503) as a distinct, reported state rather than a pass', () => {
    const results = evaluateSmoke({
      anonymousVerify: { status: 401, json: body('UNAUTHENTICATED') },
      spoofCreate: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      spoofOccupant: { status: 404, json: body('TENANT_NOT_LINKABLE') },
      unknownPhone: { status: 503, json: body('TENANT_LINK_DISABLED') },
      wrongProof: { status: 503, json: body('TENANT_LINK_DISABLED') },
    })
    expect(results.find(r => /indistinguishable/i.test(r.name))!.ok).toBe(false)
  })
})
