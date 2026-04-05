import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) } catch { return process.cwd() }
})()
const DATA_DIR = process.env.MARKETS_DATA_DIR ?? path.join(__dirname, '..', 'data')

interface Store<T> {
  version: number
  items: T[]
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function readStore<T>(filename: string): T[] {
  ensureDataDir()
  const filepath = path.join(DATA_DIR, filename)
  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    const store: Store<T> = JSON.parse(raw)
    return store.items
  } catch {
    return []
  }
}

export function writeStore<T>(filename: string, items: T[]): void {
  ensureDataDir()
  const filepath = path.join(DATA_DIR, filename)
  const store: Store<T> = { version: 1, items }
  fs.writeFileSync(filepath, JSON.stringify(store, null, 2), 'utf-8')
}
