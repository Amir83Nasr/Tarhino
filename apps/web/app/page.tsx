"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Launch screen: logo while the shell boots, then hand off to the app.
export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/week")
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Image src="/logo.svg" alt="طرحینو" width={112} height={112} priority />
    </div>
  )
}
