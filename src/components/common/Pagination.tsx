import { ChevronRight, ChevronLeft } from 'lucide-react'

interface Props {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  totalItems: number
  pageSize: number
}

// פס דפדוף גנרי (הקודם/הבא + מספרי עמודים + "מציג X-Y מתוך Z") — RTL: "הבא" מוביל קדימה
// במספור העמודים אך מוצג בצד שמאל, כמקובל בממשקים בעברית.
export function Pagination({ page, pageCount, onPageChange, totalItems, pageSize }: Props) {
  if (pageCount <= 1) return null

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pageCount, start + 4)
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12.5px] text-ink-soft print:hidden">
      <div>
        מציגה {from}-{to} מתוך {totalItems}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="עמוד קודם"
          className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
        {start > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="rounded-md border border-line px-2.5 py-1 hover:bg-[#f2f0ea]"
            >
              1
            </button>
            <span className="px-1">…</span>
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`rounded-md border px-2.5 py-1 ${
              p === page ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-[#f2f0ea]'
            }`}
          >
            {p}
          </button>
        ))}
        {end < pageCount && (
          <>
            <span className="px-1">…</span>
            <button
              type="button"
              onClick={() => onPageChange(pageCount)}
              className="rounded-md border border-line px-2.5 py-1 hover:bg-[#f2f0ea]"
            >
              {pageCount}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="עמוד הבא"
          className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  )
}
