export type LessonStatus = "planned" | "done" | "cancelled"
export type HolidayType = "official" | "school" | "personal"

export type User = {
  id: string
  phone: string
  first_name: string
  last_name: string
}

/** Fields every server row carries. */
type ServerRow = {
  id: string
  created_at: string
  updated_at: string
}

export type TeachingClass = ServerRow & {
  name: string
  grade: string | null
  color: string | null
}

export type Subject = ServerRow & {
  name: string
  color: string | null
}

export type Period = ServerRow & {
  label: string
  start_time: string
  end_time: string
  order_index: number
}

export type LessonPlan = ServerRow & {
  date: string
  class_id: string | null
  subject_id: string | null
  period_id: string | null
  start_time: string | null
  end_time: string | null
  activity: string
  notes: string
  status: LessonStatus
}

export type Holiday = ServerRow & {
  date: string
  title: string
  type: HolidayType
  description: string | null
}

export type TokenResponse = {
  access_token: string
  token_type: string
  user: User
}
