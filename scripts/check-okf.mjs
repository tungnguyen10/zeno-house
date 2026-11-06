#!/usr/bin/env node
// Validate the structural OKF v0.2 contract without adding a runtime dependency.
// This deliberately does not judge source-code parity or production deployment.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const bundle = join(projectRoot, 'knowledge')
const problems = []
let concepts = 0
let indices = 0

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry)
    if (statSync(file).isDirectory()) {
      scan(file)
      continue
    }
    if (!file.endsWith('.md')) continue
    const label = relative(projectRoot, file)
    const source = readFileSync(file, 'utf8')
    const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
    if (basename(file) === 'index.md') {
      indices++
      if (file === join(bundle, 'index.md')) {
        if (!front || !/^\s*okf_version:\s*["']?0\.2["']?\s*$/m.test(front[1]) || front[1].trim().split(/\r?\n/).length !== 1) {
          problems.push(label + ': bundle-root index may contain only okf_version: "0.2"')
        }
      }
      else if (front) problems.push(label + ': subdirectory index.md must not have frontmatter')
      const links = source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)
      for (const link of links) {
        const href = link[1].split('#')[0]
        if (!href || /^(?:https?:|mailto:|#)/i.test(href)) continue
        const target = href.startsWith('/') ? join(bundle, href.slice(1)) : resolve(dirname(file), href)
        if (!existsSync(target)) problems.push(label + ': broken index link: ' + href)
      }
      continue
    }
    if (basename(file) === 'log.md') continue
    concepts++
    if (!front) {
      problems.push(label + ': concept is missing YAML frontmatter')
      continue
    }
    const type = front[1].match(/^type:\s*(.+)$/m)
    if (!type || !type[1].trim()) problems.push(label + ': missing type')
    const status = front[1].match(/^status:\s*(.*)$/m)
    if (status && !/^(draft|stable|deprecated)$/.test(status[1].trim())) {
      problems.push(label + ': invalid OKF v0.2 status')
    }
  }
}

if (!existsSync(bundle)) problems.push('knowledge/: missing OKF bundle')
else scan(bundle)
if (existsSync(join(projectRoot, 'openspec'))) problems.push('openspec/: legacy specification directory must be removed')

if (problems.length) {
  for (const message of problems) console.error('ERROR: ' + message)
  console.error('OKF validation failed: ' + problems.length + ' problem(s)')
  process.exit(1)
}
console.warn('OKF structure verified: ' + concepts + ' concepts, ' + indices + ' index files')
