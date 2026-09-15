"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  bulkCreateStudents,
  createAssessment,
  createStudent,
  deleteAssessment,
  deleteStudent,
  listAssessmentsBySubject,
  listGradebook,
  listStudentsByClass,
  renameAssessment,
  updateStudent,
  upsertGrade,
  type Gradebook,
  type StudentInput,
} from "@/features/teaching/api"
import type { Assessment, Student } from "@/lib/api/types"

// Same caching split as teaching/hooks.ts: lookups stay 10 min, gradebook rows
// behave like ranges (5 min) since the table re-reads them on every visit.
const LOOKUP_CACHE = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const

export function useStudents(classId: string | null) {
  return useQuery({
    queryKey: ["students", classId],
    queryFn: () => listStudentsByClass(classId as string),
    enabled: !!classId,
    ...LOOKUP_CACHE,
  }).data
}

export function useAssessments(subjectId: string | null) {
  return useQuery({
    queryKey: ["assessments", subjectId],
    queryFn: () => listAssessmentsBySubject(subjectId as string),
    enabled: !!subjectId,
    ...LOOKUP_CACHE,
  }).data
}

export type { Gradebook }

// ── STUDENTS ───────────────────────────────────────────────
// Scoped per class: every mutation touches only ["students", classId].

type StudentContext = { previous: Student[] | undefined; tempId?: string }

export function useStudentMutations(classId: string) {
  const client = useQueryClient()
  const key = ["students", classId] as const

  async function snapshot() {
    await client.cancelQueries({ queryKey: key })
    return client.getQueryData<Student[]>(key)
  }

  const create = useMutation<Student, unknown, StudentInput, StudentContext>({
    mutationFn: (input) => createStudent(input),
    onMutate: async (input) => {
      const previous = await snapshot()
      const now = new Date().toISOString()
      const temp: Student = {
        id: `temp-${now}`,
        created_at: now,
        updated_at: now,
        ...input,
      }
      client.setQueryData<Student[]>(key, (old) => [...(old ?? []), temp])
      return { previous, tempId: temp.id }
    },
    onSuccess: (saved, _v, context) => {
      client.setQueryData<Student[]>(key, (old) =>
        (old ?? []).filter((s) => s.id !== context?.tempId).concat(saved)
      )
    },
    onError: (_e, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(key, context.previous)
    },
  })
  const bulk = useMutation<Student[], unknown, string[], StudentContext>({
    mutationFn: (names) => bulkCreateStudents(classId, names),
    onMutate: async () => ({ previous: await snapshot() }),
    onSuccess: (saved) => {
      client.setQueryData<Student[]>(key, (old) => [...(old ?? []), ...saved])
    },
    onError: (_e, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(key, context.previous)
    },
  })
  const save = useMutation<
    Student,
    unknown,
    { id: string; patch: Partial<StudentInput> },
    StudentContext
  >({
    mutationFn: ({ id, patch }) => updateStudent(id, patch),
    onMutate: async ({ id, patch }) => {
      const previous = await snapshot()
      client.setQueryData<Student[]>(key, (old) =>
        old?.map((s) => (s.id === id ? { ...s, ...patch } : s))
      )
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData<Student[]>(key, (old) =>
        old?.map((s) => (s.id === saved.id ? saved : s))
      )
    },
    onError: (_e, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(key, context.previous)
    },
  })
  const remove = useMutation<void, unknown, string, StudentContext>({
    mutationFn: (id) => deleteStudent(id),
    onMutate: async (id) => {
      const previous = await snapshot()
      client.setQueryData<Student[]>(key, (old) =>
        old?.filter((s) => s.id !== id)
      )
      return { previous }
    },
    onError: (_e, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(key, context.previous)
    },
  })
  return { create, bulk, save, remove }
}

// ── ASSESSMENTS ────────────────────────────────────────────

export function useAssessmentMutations(subjectId: string) {
  const client = useQueryClient()
  const key = ["gradebook", subjectId] as const

  async function snapshot() {
    await client.cancelQueries({ queryKey: key })
    return client.getQueryData<Gradebook>(key)
  }

  const create = useMutation({
    mutationFn: (title: string) => createAssessment(subjectId, title),
    onMutate: async (title) => {
      const previous = await snapshot()
      const now = new Date().toISOString()
      const temp: Assessment = {
        id: `temp-${now}`,
        created_at: now,
        updated_at: now,
        subject_id: subjectId,
        title,
        weight: 1,
        order_index: previous?.assessments.length ?? 0,
      }
      client.setQueryData<Gradebook>(key, (old) =>
        old ? { ...old, assessments: [...old.assessments, temp] } : old
      )
      return { previous, tempId: temp.id }
    },
    onSuccess: (saved, _v, context) => {
      client.setQueryData<Gradebook>(key, (old) =>
        old
          ? {
              ...old,
              assessments: old.assessments
                .filter((a) => a.id !== context?.tempId)
                .concat(saved),
            }
          : old
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameAssessment(id, title),
    onMutate: async ({ id, title }) => {
      const previous = await snapshot()
      client.setQueryData<Gradebook>(key, (old) =>
        old
          ? {
              ...old,
              assessments: old.assessments.map((a) =>
                a.id === id ? { ...a, title } : a
              ),
            }
          : old
      )
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData<Gradebook>(key, (old) =>
        old
          ? {
              ...old,
              assessments: old.assessments.map((a) =>
                a.id === saved.id ? saved : a
              ),
            }
          : old
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteAssessment(id),
    onMutate: async (id) => {
      const previous = await snapshot()
      client.setQueryData<Gradebook>(key, (old) =>
        old
          ? {
              ...old,
              assessments: old.assessments.filter((a) => a.id !== id),
              grades: old.grades.filter((g) => g.assessment_id !== id),
            }
          : old
      )
      return { previous }
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  return { create, rename, remove }
}

// ── GRADES (single-cell upsert, optimistic) ────────────────
// Patches the gradebook cache: the table reads assessments + grades from
// ["gradebook", subjectId], so a cell save swaps there, not a separate key.

export function useUpsertGrade(subjectId: string) {
  const client = useQueryClient()
  const gradeKey = ["gradebook", subjectId] as const

  return useMutation({
    mutationFn: ({
      studentId,
      assessmentId,
      grade,
    }: {
      studentId: string
      assessmentId: string
      grade: { level: string }
    }) => upsertGrade(studentId, assessmentId, grade),
    onMutate: async ({ studentId, assessmentId, grade }) => {
      await client.cancelQueries({ queryKey: gradeKey })
      const previous = client.getQueryData<Gradebook>(gradeKey)
      client.setQueryData<Gradebook>(gradeKey, (old) => {
        if (!old) return old
        const patch = { label: grade.level }
        const hit = old.grades.find(
          (g) => g.student_id === studentId && g.assessment_id === assessmentId
        )
        if (hit) {
          return {
            ...old,
            grades: old.grades.map((g) => (g === hit ? { ...g, ...patch } : g)),
          }
        }
        const now = new Date().toISOString()
        return {
          ...old,
          grades: [
            ...old.grades,
            {
              id: `temp-${now}`,
              created_at: now,
              updated_at: now,
              student_id: studentId,
              assessment_id: assessmentId,
              value: 0,
              label: grade.level,
            },
          ],
        }
      })
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData<Gradebook>(gradeKey, (old) => {
        if (!old) return old
        const merged = old.grades
          .filter(
            (g) =>
              !(
                g.student_id === saved.student_id &&
                g.assessment_id === saved.assessment_id &&
                g.id !== saved.id
              )
          )
          .map((g) => (g.id === saved.id ? saved : g))
        const seen = merged.some(
          (g) =>
            g.student_id === saved.student_id &&
            g.assessment_id === saved.assessment_id
        )
        return { ...old, grades: seen ? merged : [...merged, saved] }
      })
    },
    onError: (_e, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(gradeKey, context.previous)
    },
  })
}

export function useGradebook(subjectId: string | null) {
  return useQuery({
    queryKey: ["gradebook", subjectId],
    queryFn: () => listGradebook(subjectId as string),
    enabled: !!subjectId,
    ...LOOKUP_CACHE,
  }).data
}
