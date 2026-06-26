import { Plus, Trash2 } from 'lucide-react'
import type { DeliveredEquipmentItem } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DeliveredEquipmentPanelProps {
  equipment: DeliveredEquipmentItem[]
  onChange: (items: DeliveredEquipmentItem[]) => void
  onPersist?: () => void | Promise<void>
  readOnly?: boolean
  title?: string
  description?: string
}

function createRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `eq-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function DeliveredEquipmentPanel({
  equipment,
  onChange,
  onPersist,
  readOnly = false,
  title = 'Equipamentos entregues',
  description = 'Registre patrimônio e descrição de cada item entregue ao solicitante.',
}: DeliveredEquipmentPanelProps): JSX.Element {
  function addRow(): void {
    onChange([...equipment, { id: createRowId(), assetId: '', description: '' }])
  }

  function removeRow(id: string): void {
    onChange(equipment.filter((row) => row.id !== id))
    void onPersist?.()
  }

  function updateRow(id: string, field: 'assetId' | 'description', value: string): void {
    onChange(equipment.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  return (
    <Card className="surface-card w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Inserir
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum equipamento registrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {!readOnly ? <TableHead className="w-10" /> : null}
                  <TableHead>ID Patrimonial</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((row) => (
                  <TableRow key={row.id}>
                    {!readOnly ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {readOnly ? (
                        row.assetId || '—'
                      ) : (
                        <Input
                          value={row.assetId}
                          onChange={(e) => updateRow(row.id, 'assetId', e.target.value)}
                          onBlur={() => void onPersist?.()}
                          placeholder="Código patrimonial"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        row.description || '—'
                      ) : (
                        <Input
                          value={row.description}
                          onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                          onBlur={() => void onPersist?.()}
                          placeholder="Descrição do equipamento"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
