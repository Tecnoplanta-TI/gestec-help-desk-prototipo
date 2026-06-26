/**
 * Encerra processos escutando na porta informada (Windows).
 * Uso: node scripts/kill-port.mjs [porta]
 */

import { execSync } from 'node:child_process'

const port = process.argv[2] ?? '3847'

try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
  const pids = new Set()

  for (const line of output.split('\n')) {
    if (!line.includes('LISTENING')) continue
    const pid = line.trim().split(/\s+/).at(-1)
    if (pid && pid !== '0') pids.add(pid)
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
      console.log(`[kill-port] Processo ${pid} encerrado (porta ${port})`)
    } catch {
      // processo já encerrado
    }
  }
} catch {
  // nenhum processo na porta
}
