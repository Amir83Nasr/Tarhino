"use client"

import * as React from "react"

const MOBILE_QUERY = "(max-width: 640px)"

// Server renders desktop; a mobile client matches on first effect before paint
// of any interaction, so dialog-vs-drawer choice settles immediately.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
