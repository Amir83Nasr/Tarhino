// ── BLOG POSTS ──────────────────────────────────────────────
// Metadata only (no JSX) so sitemap.ts can import it cheaply.
// Bodies live in app/blog/bodies.tsx. Dates display in Persian;
// publishedAt stays ISO for metadata and JSON-LD.

export type BlogPost = {
  slug: string
  title: string
  description: string
  dateLabel: string
  publishedAt: string
  readingMinutes: number
  tags: string[]
  keywords: string[]
}

export const POSTS: BlogPost[] = [
  {
    slug: "tarh-dars-haftegi-15-daghighe",
    title: "طرح درس هفتگی را در ۱۵ دقیقه بنویسید",
    description:
      "روش سه‌مرحله‌ای نوشتن طرح درس هفتگی: جدول هفته، اولویت‌ها و پر کردن زنگ‌ها — بدون جزئی‌نویسی اضافه.",
    dateLabel: "۲۳ شهریور ۱۴۰۵",
    publishedAt: "2026-09-14",
    readingMinutes: 5,
    tags: ["طرح درس", "برنامه هفتگی"],
    keywords: ["طرح درس", "طرح درس هفتگی", "برنامه هفتگی معلم"],
  },
  {
    slug: "checklist-shab-ghabl-kelas",
    title: "چک‌لیست شب قبل از کلاس: فردا با خیال راحت درس بده",
    description:
      "هفت کاری که شب قبل از کلاس در ده دقیقه انجام می‌دهی تا فردا هیچ غافلگیری نداشته باشی.",
    dateLabel: "۲۰ شهریور ۱۴۰۵",
    publishedAt: "2026-09-11",
    readingMinutes: 4,
    tags: ["آمادگی کلاس", "چک‌لیست"],
    keywords: ["آمادگی برای کلاس", "چک‌لیست معلم", "شب قبل از کلاس"],
  },
  {
    slug: "modiriat-zaman-sar-kelas",
    title: "۴۰ دقیقه کلاس را چطور تقسیم کنیم؟",
    description:
      "فرمول ۵-۲۵-۷-۳ برای تقسیم زنگ کلاس: ورود و مرور، تدریس، تمرین و جمع‌بندی — با راه انعطاف برای روزهای شلوغ.",
    dateLabel: "۱۷ شهریور ۱۴۰۵",
    publishedAt: "2026-09-08",
    readingMinutes: 5,
    tags: ["مدیریت کلاس", "مدیریت زمان"],
    keywords: ["مدیریت زمان کلاس", "تقسیم وقت زنگ", "مدیریت کلاس درس"],
  },
  {
    slug: "arzeshyabi-tosifi-ebtedayi",
    title: "ارزشیابی توصیفی ابتدایی: از ثبت مستمر تا کارنامه",
    description:
      "چهار سطح ارزشیابی توصیفی، روش ثبت مستمر بدون کاغذبازی و جمع‌بندی آخر ترم برای کارنامه.",
    dateLabel: "۱۴ شهریور ۱۴۰۵",
    publishedAt: "2026-09-05",
    readingMinutes: 6,
    tags: ["ارزشیابی", "کارنامه"],
    keywords: [
      "ارزشیابی توصیفی",
      "ارزشیابی توصیفی ابتدایی",
      "کارنامه دانش‌آموز",
    ],
  },
  {
    slug: "faaliat-kelasi-bedoon-amadegi",
    title: "۱۰ فعالیت کلاسی که هیچ آمادگی نمی‌خواهد",
    description:
      "ده فعالیت ۵ تا ۱۰ دقیقه‌ای برای مرور، انرژی دادن به کلاس و پر کردن وقت‌های مرده — بدون وسیله و بدون آماده‌سازی.",
    dateLabel: "۱۱ شهریور ۱۴۰۵",
    publishedAt: "2026-09-02",
    readingMinutes: 5,
    tags: ["فعالیت کلاسی", "ایده تدریس"],
    keywords: ["فعالیت کلاسی", "بازی کلاسی", "ایده تدریس خلاق"],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug)
}
