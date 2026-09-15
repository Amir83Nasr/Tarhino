import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { POSTS } from "@/lib/blog"
import { SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "بلاگ",
  description:
    "راهنمای عملی معلم‌ها: طرح درس هفتگی، مدیریت کلاس، ارزشیابی توصیفی و فعالیت‌های کلاسی.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "بلاگ طرحینو",
    description:
      "راهنمای عملی معلم‌ها: طرح درس، مدیریت کلاس، ارزشیابی و فعالیت کلاسی.",
    url: "/blog",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "بلاگ طرحینو",
  url: `${SITE_URL}/blog`,
  inLanguage: "fa-IR",
  blogPost: POSTS.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt,
    inLanguage: "fa-IR",
  })),
}

// ── BLOG INDEX ──────────────────────────────────────────────
// Card grid over the landing look; cards link to /blog/[slug].
export default function BlogPage() {
  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div id="top" className="flex min-h-svh flex-col">
        <SiteHeader
          homeHref="/"
          fixed
          center={
            <nav
              aria-label="ناوبری اصلی"
              className="hidden items-center gap-1 md:flex"
            >
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                خانه
              </Link>
              <Link
                href="/blog"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground"
              >
                بلاگ
              </Link>
            </nav>
          }
          actions={
            <Link
              href="/login"
              className="hidden h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground md:inline-flex"
            >
              ورود به پنل کاربری
            </Link>
          }
        />

        <main className="relative flex-1 pt-16">
          <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
            <div className="mb-10 text-center">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                بلاگ طرحینو
              </h1>
              <p className="mt-2 text-muted-foreground">
                راهنمای کوتاه و عملی برای سر کلاس — بدون حاشیه
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {POSTS.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="h-full"
                >
                  <Card className="h-full shadow-sm ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <CardTitle className="text-base leading-7">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="leading-6">
                        {post.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {post.dateLabel} · {post.readingMinutes} دقیقه مطالعه
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
