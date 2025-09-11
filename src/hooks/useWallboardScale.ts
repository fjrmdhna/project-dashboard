import { RefObject, useEffect } from 'react'

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 100) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function useWallboardScale(containerRef?: RefObject<HTMLElement>) {
  useEffect(() => {
    const applyScale = () => {
      const target = containerRef?.current ?? document.documentElement
      const w = (containerRef?.current?.clientWidth ?? document.documentElement.clientWidth) || window.innerWidth || 1920
      const h = (containerRef?.current?.clientHeight ?? document.documentElement.clientHeight) || window.innerHeight || 900
      const scale = Math.min(w / 1920, h / 900, 1)
      target.style.setProperty('--wb-scale', String(scale))
    }

    const onResize = debounce(applyScale, 100)
    applyScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [containerRef])
} 