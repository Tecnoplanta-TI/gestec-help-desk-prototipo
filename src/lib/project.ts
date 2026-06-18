import type { Project, ProjectTask } from '../../shared/types'

export function getTaskTotalMinutes(task: ProjectTask): number {
  return task.appointments.reduce((acc, appointment) => acc + appointment.totalMinutes, 0)
}

export function getProjectTotalMinutes(project: Project): number {
  return project.tasks.reduce((acc, task) => acc + getTaskTotalMinutes(task), 0)
}

export function getProjectEstimatedValue(project: Project): number {
  const totalHours = getProjectTotalMinutes(project) / 60
  return totalHours * project.hourlyRate
}

export function formatMinutesAsHours(totalMinutes: number): string {
  return (totalMinutes / 60).toFixed(2)
}
