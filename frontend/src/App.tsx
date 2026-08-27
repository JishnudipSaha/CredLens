import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context'
import Layout from './components/Layout'
import Login from './pages/Login'
import LenderDashboard from './pages/lender/Dashboard'
import MsmeSearch from './pages/lender/MsmeSearch'
import MsmeReport from './pages/lender/MsmeReport'
import Decisions from './pages/lender/Decisions'
import MsmeDashboard from './pages/msme/Dashboard'
import UploadData from './pages/msme/UploadData'
import ScoreHistory from './pages/msme/ScoreHistory'
import PortfolioInsightsPage from './pages/government/PortfolioInsights'
import ModelMonitor from './pages/admin/ModelMonitor'
import AuditLog from './pages/admin/AuditLog'
import type { UserRole } from './api/client'

function RoleGuard({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!allow.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return <>{children}</>
}

function homeFor(role: UserRole): string {
  switch (role) {
    case 'LENDER': return '/lender'
    case 'MSME': return '/msme'
    case 'GOVERNMENT': return '/government'
    case 'ADMIN': return '/admin'
  }
}

function Shell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout role={role} userName={user.name}>{children}</Layout>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(user.role)} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Lender */}
        <Route path="/lender" element={<RoleGuard allow={['LENDER']}><Shell role="LENDER"><LenderDashboard /></Shell></RoleGuard>} />
        <Route path="/lender/search" element={<RoleGuard allow={['LENDER']}><Shell role="LENDER"><MsmeSearch /></Shell></RoleGuard>} />
        <Route path="/lender/report/:id" element={<RoleGuard allow={['LENDER']}><Shell role="LENDER"><MsmeReport /></Shell></RoleGuard>} />
        <Route path="/lender/decisions" element={<RoleGuard allow={['LENDER']}><Shell role="LENDER"><Decisions /></Shell></RoleGuard>} />

        {/* MSME */}
        <Route path="/msme" element={<RoleGuard allow={['MSME']}><Shell role="MSME"><MsmeDashboard /></Shell></RoleGuard>} />
        <Route path="/msme/upload" element={<RoleGuard allow={['MSME']}><Shell role="MSME"><UploadData /></Shell></RoleGuard>} />
        <Route path="/msme/history" element={<RoleGuard allow={['MSME']}><Shell role="MSME"><ScoreHistory /></Shell></RoleGuard>} />

        {/* Government */}
        <Route path="/government" element={<RoleGuard allow={['GOVERNMENT']}><Shell role="GOVERNMENT"><PortfolioInsightsPage /></Shell></RoleGuard>} />

        {/* Admin */}
        <Route path="/admin" element={<RoleGuard allow={['ADMIN']}><Shell role="ADMIN"><ModelMonitor /></Shell></RoleGuard>} />
        <Route path="/admin/audit" element={<RoleGuard allow={['ADMIN']}><Shell role="ADMIN"><AuditLog /></Shell></RoleGuard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
