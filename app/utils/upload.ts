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

function sendOnce<T>(
  url: string,
  form: FormData,
  options: UploadOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method ?? 'POST', url)
    xhr.responseType = 'json'
    xhr.timeout = options.timeoutMs ?? 30_000

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100)
        resolve(xhr.response as T)
        return
      }
      // A real HTTP response — not retriable, surface the server envelope.
      reject({
        data: xhr.response ?? {
          error: { code: 'INTERNAL', message: 'Tải lên thất bại. Vui lòng thử lại.' },
        },
        statusCode: xhr.status,
        retriable: xhr.status >= 500,
      } satisfies UploadFailure)
    })

    const networkFail = () =>
      reject({
        data: { error: { code: 'INTERNAL', message: 'Mất kết nối khi tải lên. Vui lòng thử lại.' } },
        retriable: true,
      } satisfies UploadFailure)

    xhr.addEventListener('error', networkFail)
    xhr.addEventListener('timeout', networkFail)
    xhr.addEventListener('abort', () =>
      reject({
        data: { error: { code: 'INTERNAL', message: 'Đã hủy tải lên.' } },
        retriable: false,
      } satisfies UploadFailure),
    )

    options.signal?.addEventListener('abort', () => xhr.abort())
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
