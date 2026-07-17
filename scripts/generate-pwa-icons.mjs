// Generates the PWA icon set as solid brand-colored PNGs with a centered mark.
// No raster dependency — encodes PNG via Node's built-in zlib. The mark sits
// inside the maskable safe zone so the same art works for any + maskable.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/icons')

// Brand palette (matches tailwind.config: theme #0B59DB, brand #79F4E4).
const BG = [0x0b, 0x59, 0xdb]
const MARK = [0xff, 0xff, 0xff]
const ACCENT = [0x79, 0xf4, 0xe4]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, drawPixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawPixel(x, y, size)
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
      raw[offset++] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// A centered white disc with an accent inner dot — inside the 80% safe zone.
function markPixel(x, y, size) {
  const cx = size / 2
  const cy = size / 2
  const dist = Math.hypot(x - cx, y - cy)
  const outer = size * 0.3
  const inner = size * 0.12
  if (dist <= inner) return ACCENT
  if (dist <= outer) return MARK
  return BG
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of targets) {
  writeFileSync(resolve(OUT_DIR, name), encodePng(size, markPixel))
  console.warn(`generated public/icons/${name} (${size}x${size})`)
}
