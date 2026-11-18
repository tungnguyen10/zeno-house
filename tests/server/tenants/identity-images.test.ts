import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  detectImageMime,
  stripImageMetadata,
  validateIdentityImages,
} from '../../../server/utils/identity-images'

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.from([0xff, marker, 0, 0])
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}

const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])
const APP0 = jpegSegment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'))
const APP1_EXIF = jpegSegment(0xe1, Buffer.from('Exif\0\0GPSLatitude-fictional'))
const APP2_ICC = jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0stub'))
const COMMENT = jpegSegment(0xfe, Buffer.from('camera comment'))
const DQT = jpegSegment(0xdb, Buffer.alloc(65, 1))
const SOF0 = jpegSegment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]))
const SOS = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0]))
const SCAN = Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56])

function buildJpeg(segments: Buffer[], tail: Buffer = EOI): Buffer {
  return Buffer.concat([SOI, ...segments, SOS, SCAN, tail])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function buildPng(extra: Buffer[], includeIend = true): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const idat = deflateSync(Buffer.from([0, 1, 2, 3]))
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...extra,
    pngChunk('IDAT', idat),
    ...(includeIend ? [pngChunk('IEND', Buffer.alloc(0))] : []),
  ])
}

function webpChunk(fourcc: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write(fourcc, 0, 'ascii')
  header.writeUInt32LE(data.length, 4)
  const pad = data.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0)
  return Buffer.concat([header, data, pad])
}

function buildWebp(chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

const VP8X_WITH_METADATA_FLAGS = Buffer.from([0x2c, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const VP8L_STUB = webpChunk('VP8L', Buffer.from([0x2f, 0, 0, 0, 0]))

describe('detectImageMime', () => {
  it('detects formats by magic bytes', () => {
    expect(detectImageMime(buildJpeg([APP0]))).toBe('image/jpeg')
    expect(detectImageMime(buildPng([]))).toBe('image/png')
    expect(detectImageMime(buildWebp([VP8L_STUB]))).toBe('image/webp')
  })

  it('returns null for unknown bytes', () => {
    expect(detectImageMime(Buffer.from('not an image at all'))).toBeNull()
    expect(detectImageMime(Buffer.alloc(0))).toBeNull()
  })
})

describe('stripImageMetadata', () => {
  it('drops JPEG APP1, APP13 and COM segments and keeps all other bytes', () => {
    const input = buildJpeg([APP0, APP1_EXIF, jpegSegment(0xed, Buffer.from('Photoshop')), COMMENT, APP2_ICC, DQT, SOF0])
    const output = stripImageMetadata(input, 'image/jpeg')
    expect(output.includes(Buffer.from('Exif'))).toBe(false)
    expect(output.includes(Buffer.from('GPS'))).toBe(false)
    expect(output.includes(Buffer.from('Photoshop'))).toBe(false)
    expect(output.includes(Buffer.from('camera comment'))).toBe(false)
    expect(output.equals(buildJpeg([APP0, APP2_ICC, DQT, SOF0]))).toBe(true)
  })

  it('keeps entropy-coded data after SOS byte for byte', () => {
    const output = stripImageMetadata(buildJpeg([APP1_EXIF, DQT, SOF0]), 'image/jpeg')
    expect(output.subarray(output.length - SCAN.length - EOI.length).equals(Buffer.concat([SCAN, EOI]))).toBe(true)
  })

  it('rejects a JPEG without EOI', () => {
    expect(() => stripImageMetadata(buildJpeg([APP0], Buffer.alloc(0)), 'image/jpeg')).toThrow()
  })

  it('drops PNG metadata chunks and keeps valid CRCs', () => {
    const input = buildPng([
      pngChunk('eXIf', Buffer.from('GPSfictional')),
      pngChunk('tEXt', Buffer.from('Comment\0secret')),
      pngChunk('iTXt', Buffer.from('XML:com.adobe.xmp\0\0\0\0\0xmp')),
      pngChunk('zTXt', Buffer.from('k\0\0zz')),
      pngChunk('tIME', Buffer.alloc(7)),
      pngChunk('pHYs', Buffer.alloc(9)),
    ])
    const output = stripImageMetadata(input, 'image/png')
    for (const marker of ['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']) {
      expect(output.includes(Buffer.from(marker))).toBe(false)
    }
    expect(output.equals(buildPng([pngChunk('pHYs', Buffer.alloc(9))]))).toBe(true)
  })

  it('rejects a PNG without IEND', () => {
    expect(() => stripImageMetadata(buildPng([], false), 'image/png')).toThrow()
  })

  it('drops WebP EXIF/XMP chunks, clears VP8X flags and updates RIFF size', () => {
    const input = buildWebp([
      webpChunk('VP8X', VP8X_WITH_METADATA_FLAGS),
      webpChunk('EXIF', Buffer.from('GPSfictional')),
      webpChunk('XMP ', Buffer.from('<xmp/>')),
      VP8L_STUB,
    ])
    const output = stripImageMetadata(input, 'image/webp')
    expect(output.includes(Buffer.from('EXIF'))).toBe(false)
    expect(output.includes(Buffer.from('XMP '))).toBe(false)
    expect(output.readUInt32LE(4)).toBe(output.length - 8)
    const vp8xFlags = output[20]
    expect((vp8xFlags ?? 0) & 0x0c).toBe(0)
    expect((vp8xFlags ?? 0) & 0x20).toBe(0x20)
    expect(output.includes(VP8L_STUB)).toBe(true)
  })

  it('rejects a WebP whose chunk overruns the file', () => {
    const input = buildWebp([VP8L_STUB])
    expect(() => stripImageMetadata(input.subarray(0, input.length - 3), 'image/webp')).toThrow()
  })
})

describe('validateIdentityImages', () => {
  const jpeg = () => ({ data: buildJpeg([APP1_EXIF, DQT, SOF0]) })

  it('rejects zero or more than two files with 422', () => {
    expect(validateIdentityImages([])).toMatchObject({ ok: false, status: 422 })
    expect(validateIdentityImages([jpeg(), jpeg(), jpeg()])).toMatchObject({ ok: false, status: 422 })
  })

  it('rejects files larger than 5 MiB with 413', () => {
    const big = { data: Buffer.alloc(5 * 1024 * 1024 + 1, 1) }
    expect(validateIdentityImages([big])).toMatchObject({ ok: false, status: 413 })
  })

  it('rejects unknown bytes with 415', () => {
    expect(validateIdentityImages([{ data: Buffer.from('random bytes here') }])).toMatchObject({ ok: false, status: 415 })
  })

  it('takes the type from the bytes and ignores the declared type', () => {
    const result = validateIdentityImages([{ data: buildPng([]), type: 'image/jpeg', filename: 'a.jpg' }])
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.images[0]?.mime).toBe('image/png')
  })

  it('rejects a truncated JPEG with 422', () => {
    expect(validateIdentityImages([{ data: buildJpeg([APP0], Buffer.alloc(0)) }])).toMatchObject({ ok: false, status: 422 })
  })

  it('returns metadata-free bytes', () => {
    const result = validateIdentityImages([jpeg(), { data: buildPng([pngChunk('eXIf', Buffer.from('GPS'))]) }])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.images).toHaveLength(2)
      for (const image of result.images) {
        expect(image.data.includes(Buffer.from('GPS'))).toBe(false)
      }
    }
  })
})
