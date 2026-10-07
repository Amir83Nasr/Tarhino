import type { MetadataRoute } from "next"

// App-only site: no public pages left to index.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } }
}
