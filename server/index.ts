import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import marketsRoutes from './routes/markets.js'
import settingsRoutes from './routes/settings.js'

const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)) } catch { return process.cwd() }
})()
const app = express()
const PORT = process.env.API_PORT || 3001

const distPath = process.env.MARKETS_DIST_DIR ?? path.join(__dirname, '..', 'dist')

app.use(cors({ origin: true }))
app.use(express.json({ limit: '20mb' }))

app.use('/api/markets', marketsRoutes)
app.use('/api/settings', settingsRoutes)

// Serve the built frontend (used in production/Electron)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`MarketMeh API running on http://127.0.0.1:${PORT}`)
})
