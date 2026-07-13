import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface CancellationRow {
  requestNumber: string
  justification: string
}

interface TicketCancellationRepeaterProps {
  rows: CancellationRow[]
  onChange: (rows: CancellationRow[]) => void
}

export function TicketCancellationRepeater({
  rows,
  onChange,
}: TicketCancellationRepeaterProps): JSX.Element {
  function updateRow(index: number, patch: Partial<CancellationRow>): void {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function addRow(): void {
    onChange([...rows, { requestNumber: '', justification: '' }])
  }

  function removeRow(index: number): void {
    if (rows.length <= 1) {
      onChange([{ requestNumber: '', justification: '' }])
      return
    }
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <Label>
        Solicitações a cancelar <span className="text-destructive">*</span>
      </Label>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10" />
              <TableHead>Número da solicitação</TableHead>
              <TableHead>Justificativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    aria-label="Remover linha"
                    onClick={() => removeRow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Ex: 370331"
                    value={row.requestNumber}
                    onChange={(e) => updateRow(index, { requestNumber: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Motivo do cancelamento"
                    value={row.justification}
                    onChange={(e) => updateRow(index, { justification: e.target.value })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Adicionar linha
      </Button>
    </div>
  )
}
