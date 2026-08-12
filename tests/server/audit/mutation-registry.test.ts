import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_MUTATION_POLICIES } from '../../../server/utils/audit-mutation-registry'

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(root, entry.name))
    : [join(root, entry.name)])
}

describe('audit mutation registry', () => {
  it('declares an audit owner and durability strategy for every mutation route', () => {
    const apiRoot = join(process.cwd(), 'server/api')
    const mutations = files(apiRoot)
      .map(path => relative(apiRoot, path))
      .filter(path => /\.(post|put|patch|delete)\.ts$/.test(path))
    const uncovered = mutations.filter(route => !AUDIT_MUTATION_POLICIES.some(policy => route.startsWith(policy.routePrefix)))
    expect(uncovered).toEqual([])
    expect(AUDIT_MUTATION_POLICIES.every(policy => policy.actionOwner && policy.durability)).toBe(true)
  })
})
