import type { MetadataRoute } from "next"
import { POSTS } from "@/lib/posts"
import { DOCS } from "@/lib/docs"
import { CHAINS } from "@/lib/chains"

const BASE = "https://txid.support"

export default function sitemap(): MetadataRoute.Sitemap {
  const chains: MetadataRoute.Sitemap = CHAINS.map((c) => ({
    url: `${BASE}/chains/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const posts: MetadataRoute.Sitemap = POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const docs: MetadataRoute.Sitemap = DOCS.map((doc) => ({
    url: `${BASE}/docs/${doc.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [
    { url: BASE,               lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/pricing`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/docs`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/demo`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/api`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/chains`,   lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/check`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    ...chains,
    { url: `${BASE}/blog`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/contact`,  lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
    { url: `${BASE}/terms`,    lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/privacy`,  lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    ...docs,
    ...posts,
  ]
}
