"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"
import type { Attendance } from "@/lib/api/types"

// ── ATTENDANCE (daily roll call, present/absent only) ───────
// Server stores absence rows only: an empty day means all present.
// Cache key is per class+date, so day-hopping keeps old days on screen.

const DAY_CACHE = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const

export function listAttendanceDay(classId: string, date: string) {
  const params = new URLSearchParams({ class_id: classId, date })
  return apiFetch<Attendance[]>(`/attendance/day?${params}`)
}

export function setAttendanceDay(
  classId: string,
  date: string,
  absentIds: string[]
) {
  return apiFetch<Attendance[]>("/attendance/day", {
    method: "POST",
    body: { class_id: classId, date, absent_ids: absentIds },
  })
}

export function listAttendanceSummary(classId: string) {
  const params = new URLSearchParams({ class_id: classId })
  return apiFetch<Record<string, number>>(`/attendance/summary?${params}`)
}

export function useAttendanceDay(classId: string | null, date: string) {
  return useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: () => listAttendanceDay(classId as string, date),
    enabled: !!classId,
    ...DAY_CACHE,
  }).data
}

export function useAttendanceSummary(classId: string | null) {
  return useQuery({
    queryKey: ["attendance-summary", classId],
    queryFn: () => listAttendanceSummary(classId as string),
    enabled: !!classId,
    ...DAY_CACHE,
  }).data
}

export function useSetAttendanceDay(classId: string, date: string) {
  const client = useQueryClient()
  const key = ["attendance", classId, date] as const

  return useMutation({
    mutationFn: (absentIds: string[]) =>
      setAttendanceDay(classId, date, absentIds),
    onSuccess: (saved) => {
      client.setQueryData<Attendance[]>(key, saved)
      client.invalidateQueries({ queryKey: ["attendance-summary", classId] })
    },
  })
}
