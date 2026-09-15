import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tarhino",
    short_name: "Tarhino",
    description: "برنامه‌ریزی ساده، تدریس بهتر",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "fa",
    background_color: "#060606",
    theme_color: "#be123c",
    icons: [
      {
        src: "/icons/logo.png",
        sizes: "1024x1025",
        type: "image/png",
      },
      {
        src: "/icons/logo.png",
        sizes: "1024x1025",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
