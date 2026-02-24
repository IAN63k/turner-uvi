export type QueueStatus = 'waiting' | 'in_progress' | 'done' | 'cancelled'
export type UserRole = 'profesor' | 'estudiante'

export interface QueueEntry {
  id: string
  full_name: string
  email: string
  role: UserRole
  ticket_number: number
  status: QueueStatus
  created_at: string
  attended_at: string | null
}

export interface Attendance {
  id: string
  queue_id: string | null
  full_name: string
  email: string
  role: UserRole
  ticket_number: number
  comment: string | null
  attended_at: string
}

export type AttendanceType = 'virtual' | 'physical'

export interface AppConfig {
  id: 1
  current_ticket: number
  video_link: string
  last_reset_at: string
  attendance_type: AttendanceType
  physical_location: string | null
  physical_photos: string[]
}
