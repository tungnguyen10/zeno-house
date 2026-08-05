const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char)
}

// Applies inline formatting to already-safe (escaped) text only, never to raw input.
function renderInline(rawText: string): string {
  return escapeHtml(rawText)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function isTableRowLine(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|') && line.length > 1
}

function splitTableRow(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

function isTableSeparatorLine(line: string): boolean {
  if (!isTableRowLine(line)) return false
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell))
}

function renderTable(headerCells: string[], rows: string[][]): string {
  const thead = `<thead><tr>${headerCells.map(cell => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
  return `<table>${thead}${tbody}</table>`
}

/**
 * Renders a constrained markdown subset (bold, italic, inline code, bullet lists,
 * tables, paragraphs) used by AI chat replies into safe HTML. All raw text is
 * escaped before any tag is introduced, so the output never carries injected markup.
 */
export function renderChatMarkdown(content: string): string {
  const blocks: string[] = []
  let paragraphLines: string[] = []
  let listItems: string[] = []

  function flushParagraph() {
    if (paragraphLines.length === 0) return
    blocks.push(`<p>${paragraphLines.map(renderInline).join('<br>')}</p>`)
    paragraphLines = []
  }

  function flushList() {
    if (listItems.length === 0) return
    blocks.push(`<ul>${listItems.map(item => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = (lines[i] ?? '').trim()
    const nextLine = (lines[i + 1] ?? '').trim()

    if (isTableRowLine(line) && isTableSeparatorLine(nextLine)) {
      flushParagraph()
      flushList()
      const headerCells = splitTableRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableRowLine((lines[i] ?? '').trim())) {
        rows.push(splitTableRow((lines[i] ?? '').trim()))
        i += 1
      }
      blocks.push(renderTable(headerCells, rows))
      continue
    }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(line)
    if (bulletMatch) {
      flushParagraph()
      listItems.push(bulletMatch[1] ?? '')
      i += 1
      continue
    }
    flushList()
    if (line === '') {
      flushParagraph()
      i += 1
      continue
    }
    paragraphLines.push(line)
    i += 1
  }
  flushParagraph()
  flushList()

  return blocks.join('')
}
