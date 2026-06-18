import { BlobServiceClient } from '@azure/storage-blob'
import Store from 'electron-store'

const DEFAULT_CONTAINER = 'gestec-attachments'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

interface BlobStoreSchema {
  blobConnectionString?: string
  blobContainerName?: string
}

const store = new Store<BlobStoreSchema>()

let blobServiceClient: BlobServiceClient | null = null

function getConnectionString(): string {
  const connectionString =
    store.get('blobConnectionString') ??
    process.env['BLOB_CONNECTION_STRING']

  if (!connectionString) {
    throw new Error('BLOB_NOT_CONFIGURED')
  }

  return connectionString
}

function getContainerName(): string {
  return store.get('blobContainerName') ?? process.env['BLOB_CONTAINER_NAME'] ?? DEFAULT_CONTAINER
}

function getBlobClient(): BlobServiceClient {
  if (blobServiceClient) return blobServiceClient
  blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString())
  return blobServiceClient
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

function assertFileAllowed(mimeType: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('UNSUPPORTED_FILE_TYPE')
  }
  if (size <= 0 || size > MAX_FILE_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
}

export interface UploadBlobInput {
  blobKey: string
  fileName: string
  mimeType: string
  base64Content: string
}

export interface UploadedBlobInfo {
  blobKey: string
  fileName: string
  mimeType: string
  size: number
  url: string
}

export function buildBlobKey(input: {
  entityType: 'ticket' | 'project'
  entityId: string
  scope: 'entity' | 'expense'
  expenseId?: string
  attachmentId: string
  fileName: string
}): string {
  const safeName = sanitizeFileName(input.fileName) || 'file'
  if (input.scope === 'expense') {
    return `${input.entityType}/${input.entityId}/expenses/${input.expenseId}/${input.attachmentId}/${safeName}`
  }
  return `${input.entityType}/${input.entityId}/attachments/${input.attachmentId}/${safeName}`
}

export async function uploadBase64Blob(input: UploadBlobInput): Promise<UploadedBlobInfo> {
  const buffer = Buffer.from(input.base64Content, 'base64')
  assertFileAllowed(input.mimeType, buffer.byteLength)

  const container = getBlobClient().getContainerClient(getContainerName())
  await container.createIfNotExists()

  const blockBlob = container.getBlockBlobClient(input.blobKey)
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: input.mimeType },
  })

  return {
    blobKey: input.blobKey,
    fileName: sanitizeFileName(input.fileName),
    mimeType: input.mimeType,
    size: buffer.byteLength,
    url: blockBlob.url,
  }
}

export async function deleteBlob(blobKey: string): Promise<void> {
  const container = getBlobClient().getContainerClient(getContainerName())
  await container.deleteBlob(blobKey, { deleteSnapshots: 'include' }).catch(() => undefined)
}

export async function getBlobDownloadUrl(blobKey: string): Promise<string> {
  const container = getBlobClient().getContainerClient(getContainerName())
  return container.getBlockBlobClient(blobKey).url
}

