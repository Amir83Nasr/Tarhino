import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ورود",
  description:
    "ورود به پنل کاربری طرحینو فقط با شماره موبایل؛ کمتر از یک دقیقه.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
