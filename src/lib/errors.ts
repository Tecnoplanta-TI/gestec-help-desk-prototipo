/**
 * src/lib/errors.ts
 *
 * Tradução centralizada de erros vindos do Main Process (IPC) para mensagens
 * amigáveis em português. Cada página pode sobrescrever mensagens específicas
 * e definir um fallback próprio.
 */

/** Mensagens padrão para códigos de erro comuns em toda a aplicação. */
const DEFAULT_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sessão inválida. Faça login novamente.',
  FORBIDDEN: 'Seu perfil não possui permissão para esta ação.',
  INVALID_INPUT: 'Dados inválidos. Revise os campos e tente novamente.',
  RATE_LIMIT_EXCEEDED: 'Muitas tentativas. Aguarde alguns instantes.',
  WORKFLOW_NOT_CONFIGURED:
    'Nenhum workflow padrão configurado. Acesse Configurações > Workflows.',
  TICKET_NOT_FOUND: 'Ticket não encontrado.',
  PROJECT_NOT_FOUND: 'Projeto não encontrado.',
  TRANSITION_NOT_ALLOWED: 'Transição não permitida para este ticket.',
  TIMER_NOT_FOUND: 'Cronômetro não encontrado.',
  INVALID_STATE: 'Estado inválido para a operação de cronômetro.',
  UNSUPPORTED_FILE_TYPE: 'Tipo de arquivo não suportado. Use PDF ou imagem.',
  FILE_TOO_LARGE: 'Arquivo acima do limite permitido (10MB).',
  BLOB_NOT_CONFIGURED: 'Armazenamento de arquivos não configurado.',
  EXPENSE_NOT_FOUND: 'Despesa não encontrada.',
  ATTACHMENT_NOT_FOUND: 'Anexo não encontrado.',
  EMAIL_ALREADY_EXISTS: 'Já existe um usuário com este e-mail.',
  SELF_DEACTIVATE_FORBIDDEN: 'Você não pode desativar a própria conta.',
  RESOLUTION_REQUIRED: 'Descreva o que foi realizado antes de enviar para aprovação.',
  SERVICE_DUE_DATE_REQUIRED: 'Informe o prazo do atendimento antes de concluir.',
}

interface IpcErrorOptions {
  /** Mensagens específicas da página (sobrescrevem as padrão). Chave = código. */
  overrides?: Record<string, string>
  /** Mensagem exibida quando nenhum código conhecido é encontrado. */
  fallback?: string
}

/**
 * Converte um erro de IPC em mensagem amigável.
 * Procura o código (por substring) primeiro nos overrides, depois nas padrão.
 */
export function getIpcErrorMessage(error: unknown, options: IpcErrorOptions = {}): string {
  const message = error instanceof Error ? error.message : String(error)
  const { overrides = {}, fallback = 'Não foi possível concluir a operação.' } = options

  for (const [code, friendly] of Object.entries(overrides)) {
    if (message.includes(code)) return friendly
  }

  for (const [code, friendly] of Object.entries(DEFAULT_MESSAGES)) {
    if (message.includes(code)) return friendly
  }

  return fallback
}
