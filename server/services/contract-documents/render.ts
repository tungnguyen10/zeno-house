import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

export class DocxRenderError extends Error {
  constructor(public readonly tags: string[]) {
    super(`Missing template data: ${tags.join(', ')}`)
    this.name = 'DocxRenderError'
  }
}

function resolvePath(scope: unknown, path: string): unknown {
  if (path === '.') return scope
  return path.split('.').reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), scope)
}

const parser = (tag: string) => {
  const path = tag.trim()
  return {
    get(scope: unknown, context: { scopeList: unknown[] }) {
      for (let i = context.scopeList.length - 1; i >= 0; i--) {
        const value = resolvePath(context.scopeList[i], path)
        if (value !== undefined) return value
      }
      return undefined
    },
  }
}

export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer {
  const missing: string[] = []
  const doc = new Docxtemplater(new PizZip(template), {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    parser,
    nullGetter(part: { value?: string; module?: string }) {
      if (!part.module) missing.push(String(part.value))
      return ''
    },
  })
  doc.render(data)
  if (missing.length > 0) throw new DocxRenderError([...new Set(missing)])
  const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
  const text = new PizZip(out).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '')
  if (/\{\{|\}\}/.test(text)) throw new DocxRenderError(['<unrendered>'])
  return out
}
