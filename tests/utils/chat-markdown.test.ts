import { describe, expect, it } from 'vitest'
import { renderChatMarkdown } from '~/utils/format/chat-markdown'

describe('renderChatMarkdown', () => {
  it('escapes raw HTML so injected markup is never emitted', () => {
    const html = renderChatMarkdown('<img src=x onerror=alert(1)> <script>alert(1)</script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes quotes and ampersands inside inline formatting and table cells', () => {
    const html = renderChatMarkdown('**"a" & \'b\'**\n\n| h |\n| --- |\n| <b>x</b> |')
    expect(html).toContain('<strong>&quot;a&quot; &amp; &#39;b&#39;</strong>')
    expect(html).toContain('<td>&lt;b&gt;x&lt;/b&gt;</td>')
  })

  it('renders the supported subset', () => {
    const html = renderChatMarkdown('Xin chào *bạn* `x`\n\n- một\n- hai')
    expect(html).toContain('<p>Xin chào <em>bạn</em> <code>x</code></p>')
    expect(html).toContain('<ul><li>một</li><li>hai</li></ul>')
  })
})
