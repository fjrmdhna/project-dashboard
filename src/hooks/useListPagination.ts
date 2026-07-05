"use client"

import { useCallback, useMemo } from "react"

export function useListPagination<T>(
  items: readonly T[],
  rowsPerPage: number,
  page: number,
  onPageChange: (page: number) => void
) {
  const itemCount = items.length
  const totalPages = Math.max(1, Math.ceil(itemCount / rowsPerPage))
  const safePage = Math.min(page, totalPages - 1)

  const pageItems = useMemo(() => {
    const start = safePage * rowsPerPage
    return items.slice(start, start + rowsPerPage)
  }, [items, safePage, rowsPerPage])

  const goPrev = useCallback(() => {
    onPageChange(Math.max(0, safePage - 1))
  }, [safePage, onPageChange])

  const goNext = useCallback(() => {
    onPageChange(Math.min(totalPages - 1, safePage + 1))
  }, [safePage, totalPages, onPageChange])

  return {
    page: safePage,
    pageItems,
    totalPages,
    rowsPerPage,
    goPrev,
    goNext,
    canPrev: safePage > 0,
    canNext: safePage < totalPages - 1,
  }
}
