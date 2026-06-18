#!/usr/bin/env node
/**
 * electron/scripts/seed-admin.ts — Seed do primeiro administrador
 *
 * Uso: npm run seed:admin
 *
 * Verifica se já existe um admin no banco. Se não existir, solicita
 * nome, e-mail e senha via stdin e cria o usuário administrador.
 *
 * Deve ser executado ANTES do primeiro uso da aplicação.
 */

import { createInterface } from 'readline'
import { hashPassword } from '../services/auth'
import { hasAnyAdmin, createUser, findUserByEmail } from '../services/user'

// Carrega dotenv para ter COSMOS_CONNECTION_STRING disponível
import { config } from 'dotenv'
config()

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

async function main(): Promise<void> {
  console.log('\n=== gestec · help desk — Seed do Primeiro Administrador ===\n')

  // Verifica se já existe admin
  const adminExists = await hasAnyAdmin()
  if (adminExists) {
    console.log('✅ Já existe um administrador no banco de dados.')
    console.log('   Nenhuma ação necessária.\n')
    process.exit(0)
  }

  console.log('Nenhum administrador encontrado. Criando o primeiro administrador...\n')

  const name = await ask('Nome completo: ')
  if (!name || name.length < 2) {
    console.error('❌ Nome inválido (mínimo 2 caracteres).')
    process.exit(1)
  }

  const email = await ask('E-mail: ')
  if (!email.includes('@')) {
    console.error('❌ E-mail inválido.')
    process.exit(1)
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    console.error('❌ Já existe um usuário com esse e-mail.')
    process.exit(1)
  }

  const password = await ask('Senha (mínimo 8 caracteres): ')
  if (!password || password.length < 8) {
    console.error('❌ Senha muito curta (mínimo 8 caracteres).')
    process.exit(1)
  }

  const confirm = await ask('Confirme a senha: ')
  if (password !== confirm) {
    console.error('❌ As senhas não coincidem.')
    process.exit(1)
  }

  rl.close()

  console.log('\nCriando administrador...')
  const passwordHash = await hashPassword(password)
  const user = await createUser({ name, email, role: 'admin', passwordHash })

  console.log(`\n✅ Administrador criado com sucesso!`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Nome: ${user.name}`)
  console.log(`   E-mail: ${user.email}`)
  console.log(`   Papel: ${user.role}`)
  console.log('\nVocê já pode iniciar a aplicação e fazer login.\n')
}

main().catch((err) => {
  console.error('\n❌ Erro ao criar administrador:', err.message)
  process.exit(1)
})
