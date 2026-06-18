import { FileText, Paperclip, Upload } from 'lucide-react'
import type { AttachmentFile, Expense } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ExpenseReceiptDialogProps {
  expense: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  onUpload: (file: File) => void | Promise<void>
  onDeleteReceipt: (attachmentId: string) => void | Promise<void>
  onOpenAttachment: (attachment: AttachmentFile) => void | Promise<void>
}

export function ExpenseReceiptDialog({
  expense,
  open,
  onOpenChange,
  isLoading = false,
  onUpload,
  onDeleteReceipt,
  onOpenAttachment,
}: ExpenseReceiptDialogProps): JSX.Element {
  const receipts = expense?.receiptFiles ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Comprovantes
          </DialogTitle>
          {expense ? (
            <div className="space-y-1 pt-1">
              <p className="text-sm font-medium">{expense.description}</p>
              <p className="text-sm text-muted-foreground">
                {expense.quantity} × R$ {expense.unitValue.toFixed(2)} ={' '}
                <span className="font-medium text-foreground">
                  R$ {expense.totalValue.toFixed(2)}
                </span>
              </p>
            </div>
          ) : (
            <DialogDescription>Gerencie os comprovantes desta despesa.</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="expense-receipt-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Upload className="h-4 w-4" />
              Anexar comprovante
            </Label>
            <input
              id="expense-receipt-upload"
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              disabled={isLoading || !expense}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUpload(file)
                e.currentTarget.value = ''
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">PDF ou imagem, até 10 MB.</p>
          </div>

          {receipts.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum comprovante anexado a esta despesa.
            </p>
          ) : (
            <ul className="space-y-2">
              {receipts.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
                    onClick={() => void onOpenAttachment(file)}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{file.fileName}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => void onDeleteReceipt(file.id)}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {receipts.length > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Paperclip className="h-3 w-3" />
              {receipts.length} {receipts.length === 1 ? 'arquivo' : 'arquivos'}
            </Badge>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
