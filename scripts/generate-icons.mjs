/**
 * generate-icons.mjs
 * Converts resources/icon.svg → resources/icon.png (1024px) and resources/icon.ico (multi-size)
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SVG_PATH = path.join(ROOT, 'resources', 'icon.svg')
const PNG_PATH = path.join(ROOT, 'resources', 'icon.png')
const ICO_PATH = path.join(ROOT, 'resources', 'icon.ico')

const svgBuffer = fs.readFileSync(SVG_PATH)

// ── 1. Generate icon.png at 1024×1024 ──────────────────────────────────────
await sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile(PNG_PATH)
console.log('✓ resources/icon.png')

// ── 2. Generate icon.ico (multi-size: 16, 24, 32, 48, 64, 128, 256) ────────
// Modern Windows ICO files support embedded PNG data directly (Vista+).
// Format: ICONDIR (6 bytes) + N × ICONDIRENTRY (16 bytes each) + PNG payloads

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

const pngBuffers = await Promise.all(
  ICO_SIZES.map((size) =>
    sharp(svgBuffer).resize(size, size).png().toBuffer()
  )
)

const count = ICO_SIZES.length
const headerSize = 6 + count * 16 // ICONDIR + ICONDIRENTRY[]

// Calculate offsets for each PNG payload
const offsets = []
let offset = headerSize
for (const buf of pngBuffers) {
  offsets.push(offset)
  offset += buf.length
}

// Build ICONDIR
const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0) // reserved
iconDir.writeUInt16LE(1, 2) // type = 1 (ICO)
iconDir.writeUInt16LE(count, 4)

// Build ICONDIRENTRY[] (16 bytes each)
const dirEntries = pngBuffers.map((buf, i) => {
  const size = ICO_SIZES[i]
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size === 256 ? 0 : size, 0)  // width  (0 means 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1)  // height (0 means 256)
  entry.writeUInt8(0, 2)   // color count (0 = true color)
  entry.writeUInt8(0, 3)   // reserved
  entry.writeUInt16LE(1, 4)  // planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(buf.length, 8)   // size of PNG data
  entry.writeUInt32LE(offsets[i], 12)  // offset of PNG data
  return entry
})

const icoBuffer = Buffer.concat([iconDir, ...dirEntries, ...pngBuffers])
fs.writeFileSync(ICO_PATH, icoBuffer)
console.log('✓ resources/icon.ico')

console.log('\nDone! Restart the Electron app to see the new icon.')
