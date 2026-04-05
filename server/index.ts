import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import marketsRoutes from './routes/markets.js'

const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) } catch { return process.cwd() }
})()
const app = express()
const PORT = process.env.API_PORT || 3001

// Paths — overridable via env vars for the packaged Electron app
const dataDir = process.env.MARKETS_DATA_DIR ?? path.join(__dirname, 'data')
const settingsFile = path.join(dataDir, 'settings.json')
const distPath = process.env.MARKETS_DIST_DIR ?? path.join(__dirname, '..', 'dist')

app.use(cors({ origin: true }))
app.use(express.json({ limit: '20mb' }))

app.use('/api/markets', marketsRoutes)

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
  } catch {
    return { marketPreferences: { chartStyle: 'area' } }
  }
}

function writeSettings(data: any) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf-8')
}

app.get('/api/settings', (_req, res) => {
  const settings = readSettings()
  res.json({
    config: null,
    analystProvider: {
      primary: { provider: 'Financial Modeling Prep', configured: Boolean(process.env.FMP_API_KEY), apiKeyPreview: null },
      fallback: { provider: 'Twelve Data', configured: Boolean(process.env.TWELVEDATA_API_KEY), apiKeyPreview: null },
    },
    marketPreferences: settings.marketPreferences ?? { chartStyle: 'area' },
    cronJobs: [],
  })
})

app.put('/api/settings/market-preferences', (req, res) => {
  const settings = readSettings()
  settings.marketPreferences = { chartStyle: req.body.chartStyle ?? 'area' }
  writeSettings(settings)
  res.json({ ok: true })
})

// Serve the built frontend (used in production/Electron)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`Markets API running on http://127.0.0.1:${PORT}`)
})
