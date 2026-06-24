/**
 * electron/main.ts — Main Process
 *
 * Responsabilidades:
 * - Criar e gerenciar janelas (main window + floating timer)
 * - Iniciar o servidor Fastify interno (API REST + webhooks)
 * - Registrar IPC handlers tipados
 * - Gerenciar ciclo de vida da aplicação Electron
 *
 * Segurança:
 * - contextIsolation: true  → Renderer não acessa Node.js diretamente
 * - nodeIntegration: false  → sem require() no browser
 * - sandbox: true           → processo renderer isolado
 */

import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { installIpcRpcCapture } from './ipc/capture-ipc'
import { registerAuthHandlers } from './ipc/auth-ipc'
import { registerTicketHandlers } from './ipc/ticket-ipc'
import { registerSlaHandlers } from './ipc/sla-ipc'
import { registerWorkflowHandlers } from './ipc/workflow-ipc'
import { registerTimerHandlers } from './ipc/timer-ipc'
import { registerDiscordHandlers } from './ipc/discord-ipc'
import { registerProjectHandlers } from './ipc/project-ipc'
import { registerZeevHandlers } from './ipc/zeev-ipc'
import { ensureZeevDefaultWorkflow } from './services/zeev-workflow-seed'
import { startApiServer, stopApiServer } from './api/server'
import { ensureOfflineAdminSession } from './services/session-user'

let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null

const isWebOnly = process.env.GESTEC_WEB_ONLY === '1'

installIpcRpcCapture()

// ─── Criação da janela principal ──────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false, // exibida após 'ready-to-show' para evitar flash branco
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Tema nativo segue o SO; o renderer controla claro/escuro via classe CSS
  nativeTheme.themeSource = 'system'

  // Dev: carrega Vite dev server; Prod: carrega arquivo HTML buildado
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// ─── Janela flutuante (cronômetros) ───────────────────────────────────────────

function createFloatingWindow(): void {
  floatingWindow = new BrowserWindow({
    width: 320,
    height: 480,
    minWidth: 280,
    minHeight: 200,
    frame: false, // sem barra de título nativa
    transparent: true,
    alwaysOnTop: true, // always-on-top padrão (pode ser desativado pelo usuário)
    skipTaskbar: true, // não aparece na barra de tarefas do Windows
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/floating`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../dist/index.html'), { hash: '/floating' })
  }
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isWebOnly) {
    electronApp.setAppUserModelId('com.tecnoplanta.gestec-help-desk')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
  }

  if (is.dev) {
    await ensureOfflineAdminSession()
  }

  // Registrar todos os handlers IPC por domínio
  registerAuthHandlers()
  registerTicketHandlers()
  registerSlaHandlers()
  registerWorkflowHandlers()
  registerTimerHandlers()
  registerDiscordHandlers()
  registerProjectHandlers()
  registerZeevHandlers()

  await ensureZeevDefaultWorkflow().catch((error) => {
    console.error('[zeev] falha ao garantir workflow padrão:', error)
  })

  startApiServer().catch((error) => {
    console.error('[API] erro ao iniciar servidor interno:', error)
  })

  if (isWebOnly) {
    console.log('[WEB] Modo API-only — acesse o frontend via Vite (npm run dev:vite)')
    return
  }

  createMainWindow()

  app.on('activate', () => {
    // macOS: reabrir janela ao clicar no dock (comportamento padrão do macOS)
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (isWebOnly) return
  // Windows/Linux: encerrar app quando todas as janelas forem fechadas
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void stopApiServer().catch((error) => {
    console.error('[API] erro ao encerrar servidor interno:', error)
  })
})

// ─── IPC: Janela flutuante ────────────────────────────────────────────────────

/** Abre a janela flutuante de cronômetros */
ipcMain.handle('floating-window:open', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow()
  }
  floatingWindow?.show()
})

/** Fecha a janela flutuante */
ipcMain.handle('floating-window:close', () => {
  floatingWindow?.hide()
})

/** Alterna pin (always-on-top) da janela flutuante */
ipcMain.handle('floating-window:toggle-pin', (_event, pinned: boolean) => {
  floatingWindow?.setAlwaysOnTop(pinned)
  return pinned
})

// IPC handlers adicionais (auth, timers, tickets, etc.) são registrados em
// módulos separados dentro de electron/ipc/ e importados conforme cada feature
// é desenvolvida, mantendo este arquivo limpo.

export { mainWindow, floatingWindow }
