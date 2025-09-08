import { useState, useEffect, useMemo } from 'react'

interface UseVirtualScrollOptions {
  containerHeight: number
  itemHeight: number
  overscan?: number // Number of items to render outside visible area
  scrollingDelay?: number // Delay to update isScrolling state
}

interface UseVirtualScrollReturn {
  virtualItems: Array<{
    index: number
    start: number
    end: number
    size: number
  }>
  totalSize: number
  scrollToIndex: (index: number) => void
  isScrolling: boolean
}

export function useVirtualScroll<T>(
  items: T[],
  options: UseVirtualScrollOptions
): UseVirtualScrollReturn {
  const {
    containerHeight,
    itemHeight,
    overscan = 3,
    scrollingDelay = 150
  } = options

  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)

  // Calculate total size
  const totalSize = items.length * itemHeight

  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    const visibleStartIndex = Math.floor(scrollTop / itemHeight)
    const visibleEndIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight)
    )

    // Add overscan
    const startIndex = Math.max(0, visibleStartIndex - overscan)
    const endIndex = Math.min(items.length - 1, visibleEndIndex + overscan)

    // Create virtual items
    const virtualItems = []
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight,
        size: itemHeight
      })
    }

    return { startIndex, endIndex, virtualItems }
  }, [scrollTop, containerHeight, itemHeight, overscan, items.length])

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    const targetScrollTop = index * itemHeight
    setScrollTop(Math.max(0, Math.min(targetScrollTop, totalSize - containerHeight)))
  }

  // Handle scroll events
  useEffect(() => {
    let timeoutId: number

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement
      setScrollTop(target.scrollTop)
      setIsScrolling(true)

      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        setIsScrolling(false)
      }, scrollingDelay)
    }

    // Return scroll handler for manual attachment
    return () => {
      clearTimeout(timeoutId)
    }
  }, [scrollingDelay])

  return {
    virtualItems,
    totalSize,
    scrollToIndex,
    isScrolling
  }
}

// Hook for virtual grid (2D virtualization)
interface UseVirtualGridOptions {
  containerWidth: number
  containerHeight: number
  rowHeight: number
  columnWidth: number
  overscan?: number
}

export function useVirtualGrid<T>(
  items: T[][],
  options: UseVirtualGridOptions
) {
  const {
    containerWidth,
    containerHeight,
    rowHeight,
    columnWidth,
    overscan = 2
  } = options

  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const rowCount = items.length
  const columnCount = items[0]?.length || 0

  const totalHeight = rowCount * rowHeight
  const totalWidth = columnCount * columnWidth

  const { visibleItems } = useMemo(() => {
    const startRowIndex = Math.floor(scrollTop / rowHeight)
    const endRowIndex = Math.min(
      rowCount - 1,
      Math.floor((scrollTop + containerHeight) / rowHeight)
    )

    const startColumnIndex = Math.floor(scrollLeft / columnWidth)
    const endColumnIndex = Math.min(
      columnCount - 1,
      Math.floor((scrollLeft + containerWidth) / columnWidth)
    )

    // Add overscan
    const startRow = Math.max(0, startRowIndex - overscan)
    const endRow = Math.min(rowCount - 1, endRowIndex + overscan)
    const startColumn = Math.max(0, startColumnIndex - overscan)
    const endColumn = Math.min(columnCount - 1, endColumnIndex + overscan)

    const visibleItems = []
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex++) {
        visibleItems.push({
          rowIndex,
          columnIndex,
          x: columnIndex * columnWidth,
          y: rowIndex * rowHeight,
          width: columnWidth,
          height: rowHeight,
          item: items[rowIndex]?.[columnIndex]
        })
      }
    }

    return { visibleItems }
  }, [
    scrollTop,
    scrollLeft,
    containerHeight,
    containerWidth,
    rowHeight,
    columnWidth,
    overscan,
    rowCount,
    columnCount,
    items
  ])

  return {
    visibleItems,
    totalHeight,
    totalWidth,
    setScrollTop,
    setScrollLeft
  }
}

// Utility hook for measuring item sizes dynamically
export function useDynamicSizeVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  estimatedItemHeight: number = 50,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = useState(0)
  const [itemSizes, setItemSizes] = useState<number[]>(
    new Array(items.length).fill(estimatedItemHeight)
  )

  // Update item size
  const setItemSize = (index: number, size: number) => {
    setItemSizes(prev => {
      const newSizes = [...prev]
      newSizes[index] = size
      return newSizes
    })
  }

  // Calculate cumulative sizes for positioning
  const { cumulativeSizes, totalSize } = useMemo(() => {
    const cumulativeSizes = [0]
    let totalSize = 0

    for (let i = 0; i < itemSizes.length; i++) {
      totalSize += itemSizes[i]
      cumulativeSizes.push(totalSize)
    }

    return { cumulativeSizes, totalSize }
  }, [itemSizes])

  // Find visible range using binary search
  const { virtualItems } = useMemo(() => {
    const findStartIndex = (scrollTop: number): number => {
      let low = 0
      let high = cumulativeSizes.length - 1

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        if (cumulativeSizes[mid] <= scrollTop) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      return Math.max(0, high)
    }

    const findEndIndex = (scrollTop: number, containerHeight: number): number => {
      const targetScroll = scrollTop + containerHeight
      let low = 0
      let high = cumulativeSizes.length - 1

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        if (cumulativeSizes[mid] < targetScroll) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      return Math.min(items.length - 1, low)
    }

    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan)
    const endIndex = Math.min(items.length - 1, findEndIndex(scrollTop, containerHeight) + overscan)

    const virtualItems = []
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        index: i,
        start: cumulativeSizes[i],
        end: cumulativeSizes[i + 1],
        size: itemSizes[i]
      })
    }

    return { virtualItems }
  }, [scrollTop, containerHeight, cumulativeSizes, itemSizes, overscan, items.length])

  return {
    virtualItems,
    totalSize,
    setScrollTop,
    setItemSize
  }
} 