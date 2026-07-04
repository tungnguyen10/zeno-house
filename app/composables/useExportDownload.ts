export function useExportDownload() {
  async function downloadBlob(url: string, fallbackName: string): Promise<{ blob: Blob, fileName: string }> {
    const response = await $fetch.raw<Blob>(url, { responseType: 'blob' })
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
