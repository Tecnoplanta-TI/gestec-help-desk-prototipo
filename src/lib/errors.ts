const DEFAULT_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sessao local indisponivel. Recarregue o modulo.',
  FORBIDDEN: 'Seu perfil nao possui permissao para esta acao.',
  INVALID_INPUT: 'Dados invalidos. Revise os campos e tente novamente.',
  ACCOUNT_DISABLED: 'Conta desativada. Contate o administrador.',
  DATABASE_UNAVAILABLE: 'Banco local indisponivel. Recarregue a pagina e tente novamente.',
  RATE_LIMIT_EXCEEDED: 'Muitas tentativas. Aguarde alguns instantes.',
  WORKFLOW_NOT_CONFIGURED:
    'Nenhum workflow padrao configurado. Acesse Configuracoes > Workflows.',
  TICKET_NOT_FOUND: 'Ticket nao encontrado.',
  PROJECT_NOT_FOUND: 'Projeto nao encontrado.',
  TRANSITION_NOT_ALLOWED: 'Transicao nao permitida para este ticket.',
  TIMER_NOT_FOUND: 'Cronometro nao encontrado.',
  INVALID_STATE: 'Estado invalido para a operacao de cronometro.',
  UNSUPPORTED_FILE_TYPE: 'Tipo de arquivo nao suportado. Use PDF ou imagem.',
  FILE_TOO_LARGE: 'Arquivo acima do limite permitido (10MB).',
  BLOB_NOT_CONFIGURED: 'Armazenamento de arquivos nao configurado.',
  BLOB_DISABLED: 'Anexos estao desabilitados nesta versao local.',
  EXPENSE_NOT_FOUND: 'Despesa nao encontrada.',
  ATTACHMENT_NOT_FOUND: 'Anexo nao encontrado.',
  EMAIL_ALREADY_EXISTS: 'Ja existe um usuario com este e-mail.',
  SELF_DEACTIVATE_FORBIDDEN: 'Voce nao pode desativar a propria conta.',
  UNKNOWN_CHANNEL: 'Acao indisponivel no modo local.',
  RESOLUTION_REQUIRED: 'Descreva o que foi realizado antes de enviar para aprovacao.',
  SERVICE_DUE_DATE_REQUIRED: 'Informe o prazo do atendimento antes de concluir.',
}

interface IpcErrorOptions {
  overrides?: Record<string, string>
  fallback?: string
}

export function getIpcErrorMessage(error: unknown, options: IpcErrorOptions = {}): string {
  const message = error instanceof Error ? error.message : String(error)
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : ''
  const { overrides = {}, fallback = 'Nao foi possivel concluir a operacao.' } = options

  if (code) {
    if (overrides[code]) return overrides[code]
    if (DEFAULT_MESSAGES[code]) return DEFAULT_MESSAGES[code]
  }

  for (const [errorCode, friendly] of Object.entries(overrides)) {
    if (message.includes(errorCode)) return friendly
  }

  for (const [errorCode, friendly] of Object.entries(DEFAULT_MESSAGES)) {
    if (message.includes(errorCode)) return friendly
  }

  return fallback
}
