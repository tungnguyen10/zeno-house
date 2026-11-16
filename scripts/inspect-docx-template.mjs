import { readFileSync } from 'node:fs'
import PizZip from 'pizzip'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/inspect-docx-template.mjs <file.docx>'); process.exit(1) }
const xml = new PizZip(readFileSync(file)).file('word/document.xml').asText()
const text = xml.replace(/<[^>]+>/g, '')
const tags = [...new Set([...text.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))].sort()
console.warn(tags.join('\n'))
