import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { PdfDownloadButton } from './PdfDownloadButton'

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-[34px] py-[26px]">
        <div className="mb-3 flex justify-end">
          <PdfDownloadButton />
        </div>
        <div id="print-area">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
