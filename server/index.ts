import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import marketsRoutes from './routes/markets.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.API_PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json({ limit: '20mb' }))

app.use('/api/markets', marketsRoutes)

// Serve settings for chart style preference
const settingsFile = path.join(__dirname, 'data', 'settings.json')

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
  } catch {
    return { marketPreferences: { chartStyle: 'area' } }
  }
}

function writeSettings(data: any) {
  const dir = path.dirname(settingsFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
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

// In production, serve the built frontend
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Markets API running on http://localhost:${PORT}`)
})
