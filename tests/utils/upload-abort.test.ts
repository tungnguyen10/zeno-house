import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadWithProgress } from '~/utils/upload'

class FakeXhr extends EventTarget {
  static instances: FakeXhr[] = []
  static send: (xhr: FakeXhr) => void = () => {}
  upload = new EventTarget()
  responseType = ''
  timeout = 0
  status = 200
  response: unknown = { data: { id: 'created' } }
  open = vi.fn()
  send = vi.fn(() => FakeXhr.send(this))
  abort = vi.fn(() => this.dispatchEvent(new Event('abort')))
  constructor() { super(); FakeXhr.instances.push(this) }
}

beforeEach(() => {
  FakeXhr.instances = []
  FakeXhr.send = () => {}
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('multipart upload cancellation', () => {
  it('never starts an XHR for a previously aborted session', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(uploadWithProgress('/upload', new FormData(), { signal: controller.signal })).rejects.toMatchObject({ retriable: false })
    expect(FakeXhr.instances).toHaveLength(0)
  })

  it('does not retry a transient failure after the session is aborted', async () => {
    const controller = new AbortController()
    FakeXhr.send = (xhr) => {
      xhr.dispatchEvent(new Event('error'))
      controller.abort()
    }
    await expect(uploadWithProgress('/upload', new FormData(), { signal: controller.signal, retries: 2 })).rejects.toMatchObject({ retriable: false })
    expect(FakeXhr.instances).toHaveLength(1)
  })

  it('aborts an in-flight XHR once and removes the session listener', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const upload = uploadWithProgress('/upload', new FormData(), { signal: controller.signal })
    controller.abort()
    await expect(upload).rejects.toMatchObject({ retriable: false })
    expect(FakeXhr.instances[0]!.abort).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(FakeXhr.instances).toHaveLength(1)
  })

  it('reports actual bytes and releases the abort listener on completion', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const progress = vi.fn()
    FakeXhr.send = (xhr) => {
      xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 42, total: 100 }))
      xhr.dispatchEvent(new Event('load'))
    }
    await expect(uploadWithProgress('/upload', new FormData(), { signal: controller.signal, onProgress: progress, retries: 0 })).resolves.toEqual({ data: { id: 'created' } })
    expect(progress.mock.calls).toEqual([[42], [100]])
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    controller.abort()
    expect(FakeXhr.instances[0]!.abort).not.toHaveBeenCalled()
  })

  it('respects zero retries for a non-idempotent creation', async () => {
    FakeXhr.send = xhr => xhr.dispatchEvent(new Event('timeout'))
    await expect(uploadWithProgress('/upload', new FormData(), { retries: 0 })).rejects.toMatchObject({ retriable: true })
    expect(FakeXhr.instances).toHaveLength(1)
  })
})
