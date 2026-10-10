export function useExportDownload() {
  async function downloadBlob(
    url: string,
    fallbackName: string,
    options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<{ blob: Blob, fileName: string }> {
    let response: Awaited<ReturnType<typeof $fetch.raw<Blob>>>
    try {
      response = await $fetch.raw<Blob>(url, { responseType: 'blob', ...options })
    }
    catch (cause) {
      const error = cause as { data?: unknown; response?: { _data?: unknown } }
      const payload = error.data ?? error.response?._data
      if (payload instanceof Blob && payload.type.includes('json')) {
        try {
          throw { data: JSON.parse(await payload.text()) }
        }
        catch (parsedError) {
          if (!(parsedError instanceof SyntaxError)) throw parsedError
        }
      }
      throw cause
    }
    const blob = response._data as Blob
    const disposition = response.headers.get('content-disposition') ?? ''
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
    const fileName = utf8Match?.[1]
      ? decodeURIComponent(utf8Match[1])
      : asciiMatch?.[1] ?? fallbackName

    if (import.meta.client) {
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    }

    return { blob, fileName }
  }

  return { downloadBlob }
}
