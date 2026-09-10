import { redirect } from "next/navigation"

// Auth is a single unified flow now; keep the old URL working.
export default function RegisterPage() {
  redirect("/login")
}
