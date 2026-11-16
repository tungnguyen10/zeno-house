export type IdentityImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export const IDENTITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IDENTITY_IMAGE_MAX_FILES = 2

export class InvalidImageError extends Error {
  constructor(message = 'Invalid image structure') {
    super(message)
    this.name = 'InvalidImageError'
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'XMP '])
// APP1 (Exif/XMP), APP13 (IPTC/Photoshop) and COM carry camera, GPS and free-text metadata.
const JPEG_METADATA_MARKERS = new Set([0xe1, 0xed, 0xfe])
const VP8X_EXIF_AND_XMP_FLAGS = 0x0c

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  return buf.length >= offset + bytes.length && bytes.every((byte, i) => buf[offset + i] === byte)
}

export function detectImageMime(buf: Buffer): IdentityImageMime | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(buf, PNG_SIGNATURE)) return 'image/png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

function stripJpeg(buf: Buffer): Buffer {
  const parts: Buffer[] = [buf.subarray(0, 2)]
  let offset = 2
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) throw new InvalidImageError()
    let markerOffset = offset + 1
    while (buf[markerOffset] === 0xff) markerOffset++
    const marker = buf[markerOffset]
    if (marker === undefined) throw new InvalidImageError()
    if (marker === 0xd9) {
      parts.push(buf.subarray(offset))
      return Buffer.concat(parts)
    }
    const isStandalone = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)
    if (isStandalone) {
      parts.push(buf.subarray(offset, markerOffset + 1))
      offset = markerOffset + 1
      continue
    }
    if (markerOffset + 3 > buf.length) throw new InvalidImageError()
    const segmentEnd = markerOffset + 1 + buf.readUInt16BE(markerOffset + 1)
    if (segmentEnd > buf.length || segmentEnd < markerOffset + 3) throw new InvalidImageError()
    if (marker === 0xda) {
      // Entropy-coded data follows the scan header and is copied untouched up to EOI.
      const rest = buf.subarray(offset)
      if (rest.length < 2 || rest[rest.length - 2] !== 0xff || rest[rest.length - 1] !== 0xd9) {
        throw new InvalidImageError()
      }
      parts.push(rest)
      return Buffer.concat(parts)
    }
    if (!JPEG_METADATA_MARKERS.has(marker)) parts.push(buf.subarray(offset, segmentEnd))
    offset = segmentEnd
  }
  throw new InvalidImageError()
}

function stripPng(buf: Buffer): Buffer {
  const parts: Buffer[] = [buf.subarray(0, PNG_SIGNATURE.length)]
  let offset = PNG_SIGNATURE.length
  let sawIend = false
  while (offset < buf.length) {
    if (offset + 12 > buf.length) throw new InvalidImageError()
    const length = buf.readUInt32BE(offset)
    const end = offset + 12 + length
    if (end > buf.length) throw new InvalidImageError()
    const type = buf.toString('latin1', offset + 4, offset + 8)
    if (!PNG_METADATA_CHUNKS.has(type)) parts.push(buf.subarray(offset, end))
    offset = end
    if (type === 'IEND') {
      sawIend = true
      break
    }
  }
  if (!sawIend || offset !== buf.length) throw new InvalidImageError()
  return Buffer.concat(parts)
}

function stripWebp(buf: Buffer): Buffer {
  const riffSize = buf.readUInt32LE(4)
  if (riffSize + 8 !== buf.length) throw new InvalidImageError()
  const chunks: Buffer[] = []
  let offset = 12
  while (offset < buf.length) {
    if (offset + 8 > buf.length) throw new InvalidImageError()
    const fourcc = buf.toString('latin1', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const end = offset + 8 + size + (size % 2)
    if (end > buf.length) throw new InvalidImageError()
    if (!WEBP_METADATA_CHUNKS.has(fourcc)) {
      const chunk = Buffer.from(buf.subarray(offset, end))
      if (fourcc === 'VP8X' && size >= 1) chunk[8] = (chunk[8] ?? 0) & ~VP8X_EXIF_AND_XMP_FLAGS
      chunks.push(chunk)
    }
    offset = end
  }
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

/** Removes metadata segments/chunks without decoding or re-encoding the image data. */
export function stripImageMetadata(buf: Buffer, mime: IdentityImageMime): Buffer {
  if (mime === 'image/jpeg') return stripJpeg(buf)
  if (mime === 'image/png') return stripPng(buf)
  return stripWebp(buf)
}

export type IdentityImageValidation =
  | { ok: true, images: { mime: IdentityImageMime, data: Buffer }[] }
  | { ok: false, status: 413 | 415 | 422, code: string }

/** Validates count, size and magic bytes, and returns metadata-free bytes. */
export function validateIdentityImages(
  parts: { data: Buffer, filename?: string, type?: string }[],
): IdentityImageValidation {
  if (parts.length < 1 || parts.length > IDENTITY_IMAGE_MAX_FILES) {
    return { ok: false, status: 422, code: 'IDENTITY_IMAGE_COUNT' }
  }
  const images: { mime: IdentityImageMime, data: Buffer }[] = []
  for (const part of parts) {
    if (part.data.length > IDENTITY_IMAGE_MAX_BYTES) return { ok: false, status: 413, code: 'IDENTITY_IMAGE_TOO_LARGE' }
    const mime = detectImageMime(part.data)
    if (!mime) return { ok: false, status: 415, code: 'IDENTITY_IMAGE_UNSUPPORTED' }
    try {
      images.push({ mime, data: stripImageMetadata(part.data, mime) })
    }
    catch {
      return { ok: false, status: 422, code: 'IDENTITY_IMAGE_CORRUPT' }
    }
  }
  return { ok: true, images }
}
