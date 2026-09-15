export type LessonStatus = "planned" | "done" | "cancelled"
export type HolidayType = "official" | "school" | "personal"

export type GradingMode = "descriptive"

export type User = {
  id: string
  phone: string
  first_name: string
  last_name: string
  // Whole-teacher grading mode: one key for all subjects together.
  grading_mode: GradingMode
  created_at: string
}

/** Fields every server row carries. */
type ServerRow = {
  id: string
  created_at: string
  updated_at: string
}

export type School = ServerRow & {
  name: string
  color: string | null
}

export type Shift = "morning" | "afternoon" | "rotating"
export type BellShift = "morning" | "afternoon"

export type TeachingClass = ServerRow & {
  name: string
  grade: string | null
  color: string | null
  school_id: string
  shift: Shift
  shift_anchor: string | null
  /** Bell set active this week (same as shift, unless rotating alternates). */
  active_shift: BellShift
}

export type Student = ServerRow & {
  class_id: string
  first_name: string
  last_name: string
}

export type Assessment = ServerRow & {
  subject_id: string
  title: string
  weight: number
  order_index: number
}

export type Grade = ServerRow & {
  student_id: string
  assessment_id: string
  value: number
  label: string
}

export type Subject = ServerRow & {
  name: string
  color: string | null
}

export type ClassSubject = ServerRow & {
  class_id: string
  subject_id: string
}

export type Period = ServerRow & {
  class_id: string
  label: string
  start_time: string
  end_time: string
  order_index: number
  shift: BellShift
}

export type LessonPlan = ServerRow & {
  date: string
  class_id: string
  subject_id: string
  period_id: string
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

// ── WEEKLY TIMETABLE ─────────────────────────────────────
// Fixed year-long template: one row per (weekday, period) cell.
// weekday is Saturday-first: 0 = شنبه … 4 = چهارشنبه.
export type WeeklySlot = ServerRow & {
  weekday: number
  class_id: string
  subject_id: string
  period_id: string
}

export type EnsureWeekResult = {
  created: LessonPlan[]
  errors: { index: number; detail: string }[]
}

export type TokenResponse = {
  access_token: string
  token_type: string
  user: User
}
