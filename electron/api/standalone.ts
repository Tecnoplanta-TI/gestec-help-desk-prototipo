/**
 * Servidor backend standalone para desenvolvimento no navegador.
 * Expõe a mesma API RPC usada pelo Electron via HTTP.
 *
 * Uso: npm run dev:api
 */

import { bootstrapBackend } from './bootstrap'
import { startApiServer } from './server'
import http from 'node:http'

const API_PORT = Number(process.env.PORT ?? 3847)

function isApiHealthy(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${API_PORT}/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function main(): Promise<void> {
  if (await isApiHealthy()) {
    console.log(`[web] API já está rodando em http://127.0.0.1:${API_PORT}`)
    console.log('[web] Inicie o frontend com: npm run dev:web:ui')
    return
  }

  await bootstrapBackend()
  await startApiServer({ cors: true })
  console.log('[web] Backend pronto. Inicie o frontend com: npm run dev:web:ui')
}

main().catch((error) => {
  console.error('[web] Falha ao iniciar servidor:', error)
  process.exit(1)
})
