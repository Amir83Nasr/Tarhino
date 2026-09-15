// Quick setup for elementary teachers (grades 1-6): pick a grade + shift,
// get the class with its subjects and 5 bells. Everything stays editable in
// the sections below.

export const ELEMENTARY_GRADES = [
  "پایه اول",
  "پایه دوم",
  "پایه سوم",
  "پایه چهارم",
  "پایه پنجم",
  "پایه ششم",
] as const

export type ElementaryGrade = (typeof ELEMENTARY_GRADES)[number]

const CORE = ["قرآن", "فارسی", "ریاضی", "علوم تجربی"]
const SPORT_ART = ["هنر", "تربیت بدنی"]

export const ELEMENTARY_SUBJECTS: Record<ElementaryGrade, string[]> = {
  "پایه اول": [...CORE, ...SPORT_ART],
  "پایه دوم": [
    "قرآن",
    "هدیه‌های آسمان",
    "فارسی",
    "ریاضی",
    "علوم تجربی",
    ...SPORT_ART,
  ],
  "پایه سوم": [
    "قرآن",
    "هدیه‌های آسمان",
    "فارسی",
    "ریاضی",
    "علوم تجربی",
    "مطالعات اجتماعی",
    ...SPORT_ART,
  ],
  "پایه چهارم": [
    "قرآن",
    "هدیه‌های آسمان",
    "فارسی",
    "ریاضی",
    "علوم تجربی",
    "مطالعات اجتماعی",
    ...SPORT_ART,
  ],
  "پایه پنجم": [
    "قرآن",
    "هدیه‌های آسمان",
    "فارسی",
    "ریاضی",
    "علوم تجربی",
    "مطالعات اجتماعی",
    ...SPORT_ART,
  ],
  "پایه ششم": [
    "قرآن",
    "هدیه‌های آسمان",
    "فارسی",
    "ریاضی",
    "علوم تجربی",
    "مطالعات اجتماعی",
    "کار و فناوری",
    "تفکر و پژوهش",
    ...SPORT_ART,
  ],
}

export type Shift = "morning" | "afternoon" | "rotating"

export const SHIFT_LABEL: Record<Shift, string> = {
  morning: "صبح",
  afternoon: "ظهر",
  rotating: "چرخشی",
}

export const SHIFT_HINT: Record<Shift, string> = {
  morning: "همیشه صبح",
  afternoon: "همیشه ظهر",
  rotating: "خودکار: یک هفته صبح، یک هفته ظهر",
}

// 5 bells/day, 45 min each. Teacher edits times in "زنگ‌های هر کلاس".
const LABELS = ["زنگ اول", "زنگ دوم", "زنگ سوم", "زنگ چهارم", "زنگ پنجم"]

function bells(starts: string[]) {
  return LABELS.map((label, i) => {
    const [h, m] = starts[i]!.split(":").map(Number)
    const end = new Date(0, 0, 0, h, m! + 45)
    const pad = (n: number) => String(n).padStart(2, "0")
    return {
      label,
      start_time: starts[i]!,
      end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    }
  })
}

export const SHIFT_PERIODS: Record<
  Exclude<Shift, "rotating">,
  { label: string; start_time: string; end_time: string }[]
> = {
  morning: bells(["07:30", "08:15", "09:00", "09:45", "10:30"]),
  afternoon: bells(["12:30", "13:15", "14:00", "14:45", "15:30"]),
}

export const DEFAULT_CLASS_NAME: Record<ElementaryGrade, string> = {
  "پایه اول": "اول الف",
  "پایه دوم": "دوم الف",
  "پایه سوم": "سوم الف",
  "پایه چهارم": "چهارم الف",
  "پایه پنجم": "پنجم الف",
  "پایه ششم": "ششم الف",
}
