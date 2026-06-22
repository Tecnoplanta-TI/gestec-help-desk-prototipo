/** Calcula minutos entre horários "HH:mm" no mesmo dia */
export function calcMinutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`
}
