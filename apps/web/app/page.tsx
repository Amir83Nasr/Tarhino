import type { Metadata } from "next"
import {
  CalendarRange,
  CircleCheck,
  GraduationCap,
  ListChecks,
  LogIn,
  MonitorSmartphone,
  Printer,
  Smartphone,
  Sparkles,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "طرحینو",
      description: SITE_DESCRIPTION,
      inLanguage: "fa-IR",
    },
    {
      "@type": "SoftwareApplication",
      name: "طرحینو",
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "IRT" },
      inLanguage: "fa-IR",
    },
    {
      "@type": "Organization",
      name: "طرحینو",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icons/logo.png`,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+98-930-685-3363",
        contactType: "customer service",
        areaServed: "IR",
        availableLanguage: "fa",
      },
    },
  ],
}

const BULLETS = [
  "طرح درس در یک نگاه",
  "کارنامه همیشه همراهت",
  "بدون نصب، روی گوشی و دسکتاپ",
] as const

const STEPS = [
  {
    numeral: "۱",
    icon: LogIn,
    title: "وارد شو",
    description: "فقط با شماره موبایل؛ کمتر از یک دقیقه.",
  },
  {
    numeral: "۲",
    icon: CalendarRange,
    title: "کلاست را بچین",
    description: "درس‌ها را به روزها بده، ساعت و کلاس را ثبت کن.",
  },
  {
    numeral: "۳",
    icon: Printer,
    title: "چاپ بگیر و برو سر کلاس",
    description: "خروجی تمیز یک روز یا کل هفته، آماده چاپ و پی‌دی‌اف.",
  },
] as const

const FEATURES = [
  {
    icon: CalendarRange,
    title: "طرح درس",
    description: "هر زنگ کجاست، چی درس می‌دی، ساعت چند. یک نگاه کافی است.",
  },
  {
    icon: GraduationCap,
    title: "کارنامه",
    description: "کلاس و درس را انتخاب کن، نمره بده، بعداً راحت پیدا کن.",
  },
  {
    icon: Sparkles,
    title: "دستیار",
    description: "ایده فعالیت، تمرین و مرور — درست وقتی سر کلاس لازمش داری.",
  },
  {
    icon: Printer,
    title: "چاپ تمیز",
    description: "خروجی مرتب یک روز یا کل هفته، آماده چاپ و پی‌دی‌اف.",
  },
  {
    icon: Smartphone,
    title: "ورود سریع",
    description: "فقط با شماره موبایل؛ کمتر از یک دقیقه.",
  },
  {
    icon: MonitorSmartphone,
    title: "بدون نصب",
    description: "روی گوشی و دسکتاپ، بدون نصب.",
  },
] as const

// ── LANDING ─────────────────────────────────────────────────────
// Public intro at `/`; no session probe here, so no API call on first paint.
// Entry buttons point at `/login`, which bounces authenticated users to /week.
export default function Page() {
  const panelHref = "/login"

  return (
    <div id="top" className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="#main-content"
        className="inset-s-0 fixed top-0 z-9999 -translate-y-full rounded-b-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all focus:translate-y-0"
      >
        رفتن به محتوای اصلی
      </a>
      <div className="flex min-h-svh flex-col">
        <SiteHeader
          homeHref="/"
          fixed
          center={
            <nav
              aria-label="ناوبری اصلی"
              className="hidden items-center gap-1 md:flex"
            >
              <Button asChild variant="ghost" size="sm" className="md:h-8">
                <Link href="/">خانه</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="md:h-8">
                <a href="#how-it-works">چطور کار می‌کند</a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="md:h-8">
                <a href="#why">چرا طرحینو</a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="md:h-8">
                <a href="#contact">ارتباط با ما</a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="md:h-8">
                <Link href="/blog">بلاگ</Link>
              </Button>
            </nav>
          }
          actions={
            <Button asChild size="xs" className="hidden md:inline-flex">
              <Link href={panelHref} replace>
                ورود به پنل کاربری
              </Link>
            </Button>
          }
        />

        <main id="main-content" className="relative flex-1 pt-16">
          <section>
            <div className="mx-auto max-w-7xl px-4 py-14 md:py-20 lg:py-24">
              <div className="animate-fade-in mx-auto max-w-2xl text-center">
                <div className="space-y-6">
                  <p className="inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/4 px-4 py-2 text-[10px] font-bold text-muted-foreground backdrop-blur-sm sm:text-xs">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                    </span>
                    <span className="text-primary">ساخته‌شده برای معلم‌ها</span>
                  </p>
                  <h1 className="text-3xl leading-tight font-bold text-foreground sm:text-4xl sm:leading-snug lg:text-5xl lg:leading-normal">
                    هفته‌ات را بچین،
                    <br />
                    <span className="font-bold text-primary">
                      سر کلاس بدرخش
                    </span>
                  </h1>
                  <p className="mx-auto max-w-md text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                    طرحینو طرح درس، کارنامه و دستیارت را یک‌جا جمع می‌کند؛ بدون
                    کاغذبازی، بدون شلوغی. روی گوشی و دسکتاپ، بدون نصب.
                  </p>
                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                    <Button
                      asChild
                      className="w-full px-6 text-base font-semibold sm:w-auto"
                    >
                      <Link href={panelHref} replace>
                        <LogIn className="size-5 shrink-0" />
                        ورود به پنل کاربری
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full px-6 text-base font-semibold sm:w-auto"
                    >
                      <a href="#how-it-works">
                        <ListChecks className="size-5 shrink-0" />
                        چطور کار می‌کند
                      </a>
                    </Button>
                  </div>
                  <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1">
                    {BULLETS.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm"
                      >
                        <CircleCheck className="size-4 shrink-0 text-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section
            id="how-it-works"
            className="overflow-x-hidden border-y bg-muted/50"
          >
            <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
              <div className="animate-fade-in mb-10 text-center md:mb-12">
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  سه قدم تا کلاس آماده
                </h2>
                <p className="mt-2 text-muted-foreground">
                  از ثبت‌نام تا چاپ طرح درس، راه کوتاهی در پیش داری
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {STEPS.map(({ numeral, icon: Icon, title, description }, i) => (
                  <Card
                    key={title}
                    style={{ animationDelay: `${i * 80}ms` }}
                    className="animate-fade-in h-full shadow-sm ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CardContent className="flex flex-col items-center text-center">
                      <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-7" aria-hidden />
                        <span className="-inset-s-1 absolute -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {numeral}
                        </span>
                      </div>
                      <h3 className="mb-1.5 text-lg font-semibold">{title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section id="why" className="overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4">
              <div className="py-12 md:py-16">
                <div className="animate-fade-in mb-10 text-center md:mb-12">
                  <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                    چرا طرحینو؟
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    امکاناتی که طرحینو را از کاغذبازی جدا می‌کند
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {FEATURES.map(({ icon: Icon, title, description }, i) => (
                    <Card
                      key={title}
                      style={{ animationDelay: `${i * 80}ms` }}
                      className="group animate-fade-in h-full shadow-sm ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader>
                        <div className="mb-2 flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                            <Icon className="size-5" aria-hidden />
                          </div>
                          <CardTitle className="text-base leading-snug">
                            {title}
                          </CardTitle>
                        </div>
                        <CardDescription>{description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="pb-16 md:pb-20">
                <div className="animate-fade-in mx-auto max-w-2xl text-center">
                  <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                    فردا سر کلاس، همه‌چیز آماده است
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                    طرح درس‌ات را بچین، کارنامه را نگه دار، با خیال راحت درس
                    بده.
                  </p>
                  <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                    <Button
                      asChild
                      className="w-full px-6 text-base font-semibold sm:w-auto"
                    >
                      <Link href={panelHref} replace>
                        ورود به پنل کاربری
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full px-6 text-base font-semibold sm:w-auto"
                    >
                      <a href="#contact">ارتباط با ما</a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
