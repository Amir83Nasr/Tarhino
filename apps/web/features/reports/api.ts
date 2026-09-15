"use client"

import { getAccessToken } from "@/lib/api/client"

// PDF downloads stream bytes, not JSON, so they bypass apiFetch: same base URL
// and bearer token, blob out. The server sets the Persian Content-Disposition
// filename, so the client only passes a safe ASCII fallback.
const BASE_URL = (() => {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
  ).replace(/\/+$/, "")
  return raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`
})()

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? ""
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return fallback
    }
  }
  return fallback
}

async function downloadPdf(path: string, fallback: string) {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
    credentials: "include",
  })
  if (!response.ok) throw new Error("download failed")
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filenameFrom(response, fallback)
  anchor.click()
  URL.revokeObjectURL(url)
}

export const downloadStudentListPdf = (classId: string) =>
  downloadPdf(`/reports/students/${classId}.pdf`, "tarhino-students.pdf")

export const downloadGradeSheetPdf = (subjectId: string, classId?: string) =>
  downloadPdf(
    `/reports/grades/${subjectId}.pdf${classId ? `?class_id=${classId}` : ""}`,
    "tarhino-grades.pdf"
  )

export const downloadSchedulePdf = (from: string, to: string) =>
  downloadPdf(
    `/reports/schedule.pdf?date_from=${from}&date_to=${to}`,
    "tarhino-schedule.pdf"
  )
