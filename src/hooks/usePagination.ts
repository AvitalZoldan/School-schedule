import { useEffect, useMemo, useState } from 'react'

// דפדוף גנרי לרשימות ארוכות (עובדות, היסטוריה, ימי חופשה וכו') — כדי שהעמוד לא ייגלל
// לאינסוף. מאפס אוטומטית לעמוד הראשון כשהרשימה המקורית משתנה (למשל בעקבות סינון), כדי
// שלא יישאר "תקוע" בעמוד ריק.
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(page, pageCount)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pageItems = useMemo(() => {
    const start = (clampedPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, clampedPage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [items.length])

  return { page: clampedPage, pageCount, setPage, pageItems }
}
