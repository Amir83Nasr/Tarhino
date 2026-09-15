import type { MetadataRoute } from "next"

import { POSTS } from "@/lib/blog"
import { SITE_URL } from "@/lib/site"

// Public pages only — the login route and the panel (/week, /grades, …)
// carry noindex, so they stay out of the index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...POSTS.map((post): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.publishedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
  ]
}
