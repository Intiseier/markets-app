import { app, BrowserWindow, shell } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow
let apiProcess

function startApiServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.ts')
  apiProcess = spawn('npx', ['tsx', serverPath], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    env: { ...process.env, API_PORT: '3001' },
    stdio: 'pipe',
  })

  apiProcess.stdout?.on('data', (data) => {
    console.log(`[API] ${data.toString().trim()}`)
  })

  apiProcess.stderr?.on('data', (data) => {
    console.error(`[API] ${data.toString().trim()}`)
  })

  apiProcess.on('error', (err) => {
    console.error('Failed to start API server:', err)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Markets',
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (isDev) {
    // In dev mode, the API server is started separately via npm run electron
    createWindow()
  } else {
    startApiServer()
    // Give the API server a moment to start
    setTimeout(createWindow, 1500)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (apiProcess) {
    apiProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill()
  }
})
