import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const require = createRequire(import.meta.url)

let mainWindow

function waitForServer(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function check() {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve()
        else retry()
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('API server timed out'))
        else setTimeout(check, 200)
      })
    }
    function retry() {
      if (Date.now() - start > timeout) reject(new Error('API server timed out'))
      else setTimeout(check, 200)
    }
    check()
  })
}

function startApiServer() {
  const userData = app.getPath('userData')
  process.env.API_PORT = '3001'
  process.env.MARKETS_DATA_DIR = path.join(userData, 'data')
  process.env.MARKETS_DIST_DIR = path.join(process.resourcesPath, 'dist')
  // Run server in-process — no child process needed
  require(path.join(process.resourcesPath, 'server.cjs'))
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'MarketMeh',
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadURL('http://localhost:3001')
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('com.marketmeh.app')
  if (isDev) {
    createWindow()
  } else {
    startApiServer()
    try {
      await waitForServer('http://localhost:3001/api/settings')
    } catch (e) {
      console.error('Server did not start:', e)
    }
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
