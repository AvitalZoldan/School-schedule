import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth } from './components/layout/RequireAuth'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import BaseSchedule from './pages/BaseSchedule'
import DailyFillIn from './pages/DailyFillIn'
import MissingReport from './pages/MissingReport'
import EmployeeReport from './pages/EmployeeReport'
import Leaves from './pages/Leaves'
import Draft from './pages/Draft'
import Opening from './pages/Opening'
import SubstituteList from './pages/SubstituteList'
import Classes from './pages/Classes'
import Employees from './pages/Employees'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="base" element={<BaseSchedule />} />
        <Route path="daily" element={<DailyFillIn />} />
        <Route path="missing" element={<MissingReport />} />
        <Route path="employee" element={<EmployeeReport />} />
        <Route path="leave" element={<Leaves />} />
        <Route path="draft" element={<Draft />} />
        <Route path="opening" element={<Opening />} />
        <Route path="substitutes" element={<SubstituteList />} />
        <Route path="staff" element={<Employees />} />
        <Route path="classes" element={<Classes />} />
      </Route>
    </Routes>
  )
}
