export type LessonStatus = "planned" | "done" | "cancelled"
export type HolidayType = "official" | "school" | "personal"

export type GradingMode = "numeric" | "descriptive"

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

export type TeachingClass = ServerRow & {
  name: string
  grade: string | null
  color: string | null
  school_id: string
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

export type GradeScale = ServerRow & {
  subject_id: string
  excellent_min: number
  good_min: number
  pass_min: number
  excellent_label: string
  good_label: string
  fair_label: string
  needs_label: string
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

export type TokenResponse = {
  access_token: string
  token_type: string
  user: User
}
