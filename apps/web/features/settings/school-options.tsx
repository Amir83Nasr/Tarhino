"use client"

import { useQuery } from "@tanstack/react-query"

import { listSchools } from "@/features/teaching/api"

// Schools live beside the settings sections to avoid a grades→settings import
// cycle: settings-sections renders SchoolsSection, grades page needs useSchools.
export function useSchools() {
  return useQuery({
    queryKey: ["schools"],
    queryFn: listSchools,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  }).data
}
