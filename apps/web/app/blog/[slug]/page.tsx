import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getPost, POSTS } from "@/lib/blog"
import { SITE_URL } from "@/lib/site"
import { BODIES } from "@/app/blog/bodies"

// ── BLOG POST ───────────────────────────────────────────────
// Static params from lib/blog; body from bodies.tsx.
export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      tags: post.tags,
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()
  const body = BODIES[post.slug]
  if (!body) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    inLanguage: "fa-IR",
    author: { "@type": "Organization", name: "طرحینو", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "طرحینو",
      logo: `${SITE_URL}/icons/logo.png`,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  }

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
          <article className="mx-auto max-w-2xl px-4 py-12 md:py-16">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 className="text-2xl leading-9 font-bold tracking-tight md:text-3xl md:leading-11">
              {post.title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {post.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {post.dateLabel} · {post.readingMinutes} دقیقه مطالعه
            </p>
            <div className="blog-body mt-8">{body}</div>
          </article>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
