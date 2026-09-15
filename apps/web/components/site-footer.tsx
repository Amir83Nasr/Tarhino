import { ArrowUp, Mail, Phone, Send } from "lucide-react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

// Shared footer for the landing page and the blog pages.
export function SiteFooter() {
  return (
    <footer id="contact" className="border-t bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-x-6 gap-y-8 px-4 py-10 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          <span className="text-lg font-bold">طرحینو</span>
          <p className="text-sm leading-6 text-muted-foreground">
            طرح درس، کارنامه و دستیار معلم؛ یک‌جا، بدون کاغذبازی.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">لینک‌های سریع</p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground">
                خانه
              </Link>
            </li>
            <li>
              <a href="/#how-it-works" className="hover:text-foreground">
                چطور کار می‌کند
              </a>
            </li>
            <li>
              <Link href="/blog" className="hover:text-foreground">
                بلاگ
              </Link>
            </li>
            <li>
              <a href="/#why" className="hover:text-foreground">
                چرا طرحینو
              </a>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">ارتباط با ما</p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Send className="size-4 shrink-0" />
              <span>بله:</span>
              <a
                href="https://ble.ir/Amir83Nasr"
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="text-foreground"
              >
                Amir83Nasr
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <span>تلفن:</span>
              <a href="tel:+989306853363" className="text-foreground">
                ۰۹۳۰۶۸۵۳۳۶۳
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              <span>ایمیل:</span>
              <a
                href="mailto:amirhossein.nasrollahi.main@gmail.com"
                dir="ltr"
                className="text-foreground"
              >
                amirhossein.nasrollahi.main@gmail.com
              </a>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">انتقادها و پیشنهادها</p>
          <p className="text-sm leading-6 text-muted-foreground">
            نظر شما طرحینو را بهتر می‌کند؛ از همین راه‌های ارتباطی بفرستید.
          </p>
        </div>
      </div>
      <div className="pb-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            تمامی حقوق مادی و معنوی این وبسایت متعلق به توپ‌سِت می‌باشد.
          </p>
          <Button
            asChild
            variant="ghost"
            size="xs"
            className="mx-auto text-muted-foreground sm:mx-0"
          >
            <a href="#top">
              <ArrowUp className="size-3.5" />
              بازگشت به بالا
            </a>
          </Button>
        </div>
      </div>
    </footer>
  )
}
