"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import {
  createLessonPlan,
  deleteLessonPlan,
  getGradeScale,
  listClasses,
  listClassSubjectsByClass,
  listHolidays,
  listLessonPlans,
  listPeriods,
  listPeriodsByClass,
  listSubjects,
  updateLessonPlan,
  type LessonPlanInput,
} from "@/features/teaching/api"
import type { GradeScale, LessonPlan } from "@/lib/api/types"

export type { LessonPlanInput }

// ── READS ──────────────────────────────────────────────────
// Server is the source of truth. Date ranges are part of the key so the day
// and week views cache independently.

// Tabs unmount pages but the client survives: a range stays fresh 5 min, so
// tab-hopping renders from cache with zero GETs. Own writes patch the cache
// directly (see below); other-device edits arrive as background refetch once
// stale, never a blank skeleton.
const RANGE_CACHE = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const

export function useLessonPlans(from: string, to: string) {
  const query = useQuery({
    queryKey: ["lesson-plans", from, to],
    queryFn: () => listLessonPlans(from, to),
    // Week navigation swaps the key; keep the old days on screen instead of
    // flashing skeletons while the new range loads.
    placeholderData: keepPreviousData,
    ...RANGE_CACHE,
  })
  return query.data
}

export function useHolidays(from: string, to: string) {
  const query = useQuery({
    queryKey: ["holidays", from, to],
    queryFn: () => listHolidays(from, to),
    placeholderData: keepPreviousData,
    ...RANGE_CACHE,
  })
  return query.data
}

// Lookups barely change, so they stay fresh 10 min and never refetch on
// window focus: every page would otherwise re-fire the same 3 GETs.
const LOOKUP_CACHE = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const

export function useClasses() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: listClasses,
    ...LOOKUP_CACHE,
  }).data
}

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: listSubjects,
    ...LOOKUP_CACHE,
  }).data
}

export function usePeriods() {
  return useQuery({
    queryKey: ["periods"],
    queryFn: listPeriods,
    ...LOOKUP_CACHE,
  }).data
}

/** Bells of one class. Server is the filter; settings edits target this key. */
export function usePeriodsByClass(classId: string | null) {
  return useQuery({
    queryKey: ["periods", classId],
    queryFn: () => listPeriodsByClass(classId as string),
    enabled: !!classId,
    ...LOOKUP_CACHE,
  }).data
}

export function useClassSubjects(classId: string | null) {
  return useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: () => listClassSubjectsByClass(classId as string),
    enabled: !!classId,
    ...LOOKUP_CACHE,
  }).data
}

/** Per-subject descriptive bands for grades; settings owns the mutations. */
export function useGradeScale(subjectId: string | null) {
  return useQuery({
    queryKey: ["grade-scale", subjectId],
    queryFn: () => getGradeScale(subjectId as string),
    enabled: !!subjectId,
    ...LOOKUP_CACHE,
  }).data
}

export type { GradeScale }

/** Name lookups shared by the day and week views. */
export function useLookups() {
  const classes = useClasses()
  const subjects = useSubjects()
  const periods = usePeriods()

  return {
    classes: classes ?? [],
    subjects: subjects ?? [],
    periods: periods ?? [],
    className: (id: string | null) => classes?.find((c) => c.id === id)?.name,
    subjectName: (id: string | null) =>
      subjects?.find((s) => s.id === id)?.name,
    periodLabel: (id: string | null) =>
      periods?.find((p) => p.id === id)?.label,
    period: (id: string | null) => periods?.find((p) => p.id === id),
  }
}

// ── WRITES ─────────────────────────────────────────────────
// Optimistic: the list updates instantly, the server confirms in the
// background. Rollback on error. No refetch after write: the server returns
// the saved row and onSuccess swaps it into the cache, so a save costs one
// request instead of one plus a full list GET.

// QueryClient as a type, not a hook call: the helpers below run outside
// components (tabs, import, assistant), so they take the client as a param.
type PlansClient = QueryClient
type PlansSnapshot = ReturnType<PlansClient["getQueriesData"]>

async function snapshotPlans(client: PlansClient): Promise<PlansSnapshot> {
  await client.cancelQueries({ queryKey: ["lesson-plans"] })
  return client.getQueriesData<LessonPlan[]>({ queryKey: ["lesson-plans"] })
}

function restorePlans(client: PlansClient, snapshot: PlansSnapshot) {
  snapshot.forEach(([key, data]) => client.setQueryData(key, data))
}

/** Swap the server-confirmed row into every cached range; drop our temp row. */
function swapSavedRow(
  client: PlansClient,
  saved: LessonPlan,
  dropId: string | null,
  tempId: string | null
) {
  client
    .getQueriesData<LessonPlan[]>({ queryKey: ["lesson-plans"] })
    .forEach(([key]) => {
      const [, from, to] = key as [string, string?, string?]
      const inRange = !from || !to || (from <= saved.date && saved.date <= to)
      client.setQueryData<LessonPlan[]>(key, (old) => {
        const list = (old ?? []).filter(
          (p) => p.id !== dropId && p.id !== tempId
        )
        return inRange ? [...list, saved] : list
      })
    })
}

export function useSaveLessonPlan(plan: LessonPlan | null, onDone: () => void) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: LessonPlanInput) =>
      plan ? updateLessonPlan(plan.id, input) : createLessonPlan(input),
    onMutate: async (input) => {
      const previous = await snapshotPlans(client)
      let tempId: string | null = null
      if (plan) {
        client.setQueriesData<LessonPlan[]>(
          { queryKey: ["lesson-plans"] },
          (old) =>
            old?.map((p) =>
              p.id === plan.id
                ? { ...p, ...input, notes: input.notes ?? p.notes }
                : p
            )
        )
      } else {
        const now = new Date().toISOString()
        tempId = `temp-${now}`
        const temp: LessonPlan = {
          id: tempId,
          created_at: now,
          updated_at: now,
          date: input.date,
          activity: input.activity,
          class_id: input.class_id,
          subject_id: input.subject_id,
          period_id: input.period_id,
          start_time: input.start_time,
          end_time: input.end_time,
          status: input.status,
          notes: input.notes ?? "",
        }
        // Only ranges containing the new date get the row.
        client
          .getQueriesData<LessonPlan[]>({ queryKey: ["lesson-plans"] })
          .forEach(([key]) => {
            const [, from, to] = key as [string, string?, string?]
            if (!from || !to || (from <= input.date && input.date <= to)) {
              client.setQueryData<LessonPlan[]>(key, (old) => [
                ...(old ?? []),
                temp,
              ])
            }
          })
      }
      // Dialog closes now; the error toast still fires if the server rejects.
      onDone()
      return { previous, tempId }
    },
    onSuccess: (saved, _input, context) => {
      // Server row wins: temp id gone, no refetch needed.
      swapSavedRow(client, saved, plan?.id ?? null, context?.tempId ?? null)
    },
    onError: (_error, _input, context) => {
      if (context) restorePlans(client, context.previous)
    },
  })
}

export function removePlanFromCache(client: PlansClient, id: string) {
  client.setQueriesData<LessonPlan[]>({ queryKey: ["lesson-plans"] }, (old) =>
    old?.filter((p) => p.id !== id)
  )
}

/** Append server rows into every cached range; import and assistant share it. */
export function appendPlansToCache(client: PlansClient, saved: LessonPlan[]) {
  for (const plan of saved) {
    client
      .getQueriesData<LessonPlan[]>({ queryKey: ["lesson-plans"] })
      .forEach(([key]) => {
        const [, from, to] = key as [string, string?, string?]
        if (!from || !to || (from <= plan.date && plan.date <= to)) {
          client.setQueryData<LessonPlan[]>(key, (old) => [
            ...(old ?? []),
            plan,
          ])
        }
      })
  }
}

export function useDeleteLessonPlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLessonPlan(id),
    onMutate: async (id) => {
      const previous = await snapshotPlans(client)
      removePlanFromCache(client, id)
      return { previous }
    },
    // Row already removed from cache: a 204 needs no refetch.
    onError: (_error, _id, context) => {
      if (context) restorePlans(client, context.previous)
    },
  })
}

/** Warm the adjacent weeks so navigation feels instant. Fire and forget. */
export function prefetchWeek(client: PlansClient, from: string, to: string) {
  // Same freshness as a real read: prefetched weeks must survive tab-hopping
  // as long as visited ones, otherwise the warmup is wasted.
  void client.prefetchQuery({
    queryKey: ["lesson-plans", from, to],
    queryFn: () => listLessonPlans(from, to),
    ...RANGE_CACHE,
  })
  void client.prefetchQuery({
    queryKey: ["holidays", from, to],
    queryFn: () => listHolidays(from, to),
    ...RANGE_CACHE,
  })
}
