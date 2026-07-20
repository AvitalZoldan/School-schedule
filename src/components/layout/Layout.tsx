import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="max-w-[1180px] flex-1 px-[34px] py-[26px]">
        <Outlet />
      </main>
    </div>
  )
}
