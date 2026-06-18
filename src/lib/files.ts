/**
 * src/lib/files.ts
 *
 * Utilitários de arquivo do Renderer.
 */

/**
 * Lê um `File` e retorna seu conteúdo em base64 (sem o prefixo data URL),
 * pronto para envio ao Main Process via IPC.
 */
export async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })

  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('INVALID_FILE_CONTENT')
  return base64
}
