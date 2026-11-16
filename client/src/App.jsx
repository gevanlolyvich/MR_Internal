import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import RiskRegisterListPage from './pages/RiskRegister/RiskRegisterListPage';
import RiskRegisterFormPage from './pages/RiskRegister/RiskRegisterFormPage';
import RiskRegisterDetailPage from './pages/RiskRegister/RiskRegisterDetailPage';
import ApprovalListPage from './pages/Approval/ApprovalListPage';
import UserManagementPage from './pages/UserManagement/UserManagementPage';
import BranchManagementPage from './pages/BranchManagement/BranchManagementPage';
import MasterDataPage from './pages/MasterData/MasterDataPage';
import MatrixPage from './pages/Matrix/MatrixPage';
import MonitoringPage from './pages/Monitoring/MonitoringPage';
import AuditTrailPage from './pages/AuditTrail/AuditTrailPage';
import { Spinner } from './components/ui/Common';

function RequireAuth({ children, perm }) {
  const { isAuthenticated, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (perm && !can(perm)) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-bold text-jxb-red">403 — Akses Ditolak</p>
        <p className="mt-2 text-sm text-slate-500">Anda tidak memiliki izin untuk membuka halaman ini.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/risk-registers"
          element={
            <RequireAuth perm="risk-register:view">
              <RiskRegisterListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/risk-registers/new"
          element={
            <RequireAuth perm="risk-register:create">
              <RiskRegisterFormPage />
            </RequireAuth>
          }
        />
        <Route path="/risk-registers/:id" element={<RiskRegisterDetailPage />} />
        <Route
          path="/risk-registers/:id/edit"
          element={
            <RequireAuth perm="risk-register:edit">
              <RiskRegisterFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/approvals"
          element={
            <RequireAuth perm={null}>
              <ApprovalListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth perm="user:manage">
              <UserManagementPage />
            </RequireAuth>
          }
        />
        <Route
          path="/branches"
          element={
            <RequireAuth perm="branch:manage">
              <BranchManagementPage />
            </RequireAuth>
          }
        />
        <Route
          path="/masters"
          element={
            <RequireAuth perm="master:manage">
              <MasterDataPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matrix"
          element={
            <RequireAuth perm="matrix:view">
              <MatrixPage />
            </RequireAuth>
          }
        />
        <Route
          path="/monitoring"
          element={
            <RequireAuth perm="monitoring:view">
              <MonitoringPage />
            </RequireAuth>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireAuth perm="audit:view">
              <AuditTrailPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
