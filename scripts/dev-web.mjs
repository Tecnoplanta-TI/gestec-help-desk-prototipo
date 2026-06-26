/**
 * Inicia o modo navegador: sobe a API só se necessário.
 * Reinicia a API se estiver ativa sem Cosmos mas COSMOS_CONNECTION_STRING foi definida.
 */

import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import http from 'node:http'

const API_PORT = Number(process.env.PORT ?? 3847)
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`

function npmRun(script) {
  return spawn('npm', ['run', script], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
}

function fetchHealth() {
  return new Promise((resolve) => {
    const req = http.get(API_HEALTH_URL, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode === 200,
            data: body ? JSON.parse(body) : null,
          })
        } catch {
          resolve({ ok: res.statusCode === 200, data: null })
        }
      })
    })
    req.on('error', () => resolve({ ok: false, data: null }))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve({ ok: false, data: null })
    })
  })
}

function killPort() {
  execSync(`node scripts/kill-port.mjs ${API_PORT}`, { stdio: 'inherit' })
}

let health = await fetchHealth()
const envHasCosmos = Boolean(process.env.COSMOS_CONNECTION_STRING)
const apiMissingCosmos = health.ok && !health.data?.cosmosConfigured && envHasCosmos

if (apiMissingCosmos) {
  console.log(
    `[dev:web] API em :${API_PORT} sem Cosmos — reiniciando com variáveis atuais do terminal`,
  )
  killPort()
  health = { ok: false, data: null }
}

if (health.ok) {
  console.log(`[dev:web] API já disponível em :${API_PORT} — iniciando apenas o frontend`)
  if (!health.data?.cosmosConfigured) {
    console.log(
      '[dev:web] Aviso: Cosmos não configurado nesta API. Defina COSMOS_CONNECTION_STRING e rode npm run dev:api:restart',
    )
  }
  const ui = npmRun('dev:web:ui')
  ui.on('exit', (code) => process.exit(code ?? 0))
} else {
  console.log(`[dev:web] Iniciando API (:${API_PORT}) e frontend`)
  const both = spawn(
    'npx',
    ['concurrently', '-k', 'npm:dev:api', 'npm:dev:web:ui'],
    { stdio: 'inherit', shell: true, env: process.env },
  )
  both.on('exit', (code) => process.exit(code ?? 0))
}
