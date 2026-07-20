import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import BaseSchedule from './pages/BaseSchedule'
import DailyFillIn from './pages/DailyFillIn'
import MissingReport from './pages/MissingReport'
import EmployeeReport from './pages/EmployeeReport'
import Leaves from './pages/Leaves'
import Draft from './pages/Draft'
import Opening from './pages/Opening'
import SubstituteList from './pages/SubstituteList'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="base" element={<BaseSchedule />} />
        <Route path="daily" element={<DailyFillIn />} />
        <Route path="missing" element={<MissingReport />} />
        <Route path="employee" element={<EmployeeReport />} />
        <Route path="leave" element={<Leaves />} />
        <Route path="draft" element={<Draft />} />
        <Route path="opening" element={<Opening />} />
        <Route path="substitutes" element={<SubstituteList />} />
      </Route>
    </Routes>
  )
}
