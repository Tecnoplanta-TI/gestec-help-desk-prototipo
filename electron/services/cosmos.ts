/**
 * electron/services/cosmos.ts — Cliente Azure Cosmos DB
 *
 * Inicializa e exporta o cliente Cosmos DB para uso nos serviços do Main Process.
 * Connection string armazenada no electron-store (nunca exposta ao Renderer).
 *
 * Os containers são criados automaticamente se não existirem (throughput serverless).
 */

import { CosmosClient, Database } from '@azure/cosmos'
import { createAppStore } from '../lib/store'

interface StoreSchema {
  cosmosConnectionString?: string
}

const store = createAppStore<StoreSchema>()

let _db: Database | null = null

export function isCosmosConfigured(): boolean {
  return Boolean(store.get('cosmosConnectionString') ?? process.env['COSMOS_CONNECTION_STRING'])
}

/**
 * Retorna a instância do banco de dados Cosmos DB.
 * Lê a connection string do electron-store ou da variável de ambiente (dev).
 */
export function getDatabase(): Database {
  if (_db) return _db

  const connectionString =
    store.get('cosmosConnectionString') ??
    process.env['COSMOS_CONNECTION_STRING']

  if (!connectionString) {
    throw new Error(
      '[cosmos] Connection string não configurada. ' +
        'Defina COSMOS_CONNECTION_STRING no ambiente de desenvolvimento ' +
        'ou configure via Settings na aplicação.',
    )
  }

  const client = new CosmosClient(connectionString)
  const databaseId = process.env['COSMOS_DATABASE_ID'] ?? 'gestec_helpDesk'
  _db = client.database(databaseId)
  return _db
}

/**
 * Retorna um container pelo nome, criando-o se não existir.
 * Usa throughput serverless (sem RU/s fixas).
 */
export async function getContainer(containerId: string) {
  const db = getDatabase()
  const { container } = await db.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ['/id'] },
  })
  return container
}
