/**
 * XHR-based multipart uploader with progress + retry. `$fetch` cannot report
 * upload progress, so identity-image and document uploads use this helper.
 * Network/timeout failures are retried; HTTP error responses (validation,
 * forbidden, etc.) are surfaced immediately in the standard `{ data.error }`
 * envelope so `getApiErrorMessage` keeps working.
 */
export interface UploadOptions {
  method?: 'POST'
  onProgress?: (percent: number) => void
  /** Extra attempts after the first for transient network/timeout errors. */
  retries?: number
  timeoutMs?: number
  signal?: AbortSignal
}

interface UploadFailure {
  data?: { error?: { code?: string; message?: string; details?: unknown } }
  statusCode?: number
  retriable?: boolean
}

function abortedUpload(): UploadFailure {
  return { data: { error: { code: 'INTERNAL', message: 'Đã hủy tải lên.' } }, retriable: false }
}

function sendOnce<T>(
  url: string,
  form: FormData,
  options: UploadOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortedUpload())
      return
    }
    const xhr = new XMLHttpRequest()
    let settled = false
    const cleanup = () => options.signal?.removeEventListener('abort', onAbort)
    const fail = (error: UploadFailure) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => {
      xhr.abort()
      // Aborting before send() need not emit an XHR abort event.
      fail(abortedUpload())
    }
    xhr.open(options.method ?? 'POST', url)
    xhr.responseType = 'json'
    xhr.timeout = options.timeoutMs ?? 30_000

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (settled) return
      if (xhr.status >= 200 && xhr.status < 300) {
        settled = true
        cleanup()
        options.onProgress?.(100)
        resolve(xhr.response as T)
        return
      }
      // A real HTTP response — not retriable, surface the server envelope.
      fail({
        data: xhr.response ?? {
          error: { code: 'INTERNAL', message: 'Tải lên thất bại. Vui lòng thử lại.' },
        },
        statusCode: xhr.status,
        retriable: xhr.status >= 500,
      } satisfies UploadFailure)
    })

    const networkFail = () =>
      fail({
        data: { error: { code: 'INTERNAL', message: 'Mất kết nối khi tải lên. Vui lòng thử lại.' } },
        retriable: true,
      } satisfies UploadFailure)

    xhr.addEventListener('error', networkFail)
    xhr.addEventListener('timeout', networkFail)
    xhr.addEventListener('abort', () => fail(abortedUpload()))

    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) { onAbort(); return }
    xhr.send(form)
  })
}

export async function uploadWithProgress<T>(
  url: string,
  form: FormData,
  options: UploadOptions = {},
): Promise<T> {
  const retries = options.retries ?? 1
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Identity changes can abort between attempts; never send under new cookies.
    if (options.signal?.aborted) throw abortedUpload()
    try {
      return await sendOnce<T>(url, form, options)
    }
    catch (error) {
      lastError = error
      if (!(error as UploadFailure).retriable) throw error
    }
  }
  throw lastError
}
