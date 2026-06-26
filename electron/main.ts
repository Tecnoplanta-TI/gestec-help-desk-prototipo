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

import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { installIpcRpcBridge } from './ipc/rpc-bridge'
import { rpcHandle } from './ipc/rpc-handle'
import { bootstrapBackend } from './api/bootstrap'
import { startApiServer, stopApiServer } from './api/server'
import { ensureOfflineAdminSession } from './services/session-user'

installIpcRpcBridge()

let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null

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
  // Configurações recomendadas para apps Electron em produção
  electronApp.setAppUserModelId('com.tecnoplanta.gestec-help-desk')

  // Atalho de DevTools apenas em desenvolvimento
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (is.dev) {
    await ensureOfflineAdminSession()
  }

  await bootstrapBackend()

  startApiServer().catch((error) => {
    console.error('[API] erro ao iniciar servidor interno:', error)
  })

  createMainWindow()

  app.on('activate', () => {
    // macOS: reabrir janela ao clicar no dock (comportamento padrão do macOS)
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
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
rpcHandle('floating-window:open', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow()
  }
  floatingWindow?.show()
})

/** Fecha a janela flutuante */
rpcHandle('floating-window:close', () => {
  floatingWindow?.hide()
})

/** Alterna pin (always-on-top) da janela flutuante */
rpcHandle('floating-window:toggle-pin', (_event, pinned: boolean) => {
  floatingWindow?.setAlwaysOnTop(pinned)
  return pinned
})

// IPC handlers adicionais (auth, timers, tickets, etc.) são registrados em
// módulos separados dentro de electron/ipc/ e importados conforme cada feature
// é desenvolvida, mantendo este arquivo limpo.

export { mainWindow, floatingWindow }
