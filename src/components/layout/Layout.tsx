import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { PdfDownloadButton } from './PdfDownloadButton'
import { Footer } from './Footer'
import { useAuth } from '../../lib/AuthContext'
import { useSystemSettings } from '../../hooks/useSystemSettings'
import { useIdleLogout } from '../../hooks/useIdleLogout'

export function Layout() {
  const { signOut } = useAuth()
  const { data: systemSettings } = useSystemSettings()
  useIdleLogout(systemSettings?.idle_timeout_minutes, signOut)

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
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
      <Footer />
    </div>
  )
}
