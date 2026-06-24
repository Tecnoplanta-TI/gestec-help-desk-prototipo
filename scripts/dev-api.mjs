/**
 * Inicia electron-vite em modo API-only (sem janela Electron).
 */
import { spawn } from 'node:child_process'

process.env.GESTEC_WEB_ONLY = '1'

const child = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
