import { HashRouter, Route, Routes } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import ConfigMissing from './components/ConfigMissing';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './contexts/AuthContext';
import AttendancePage from './pages/AttendancePage';
import BootstrapPage from './pages/BootstrapPage';
import ChildrenPage from './pages/ChildrenPage';
import DashboardPage from './pages/DashboardPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupsPage from './pages/GroupsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PaymentsPage from './pages/PaymentsPage';
import UsersPage from './pages/UsersPage';

function InactiveAccount() {
  const { logout } = useAuth();
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand-mark">GC</div>
        <h1>המשתמש אינו פעיל</h1>
        <p>מנהל המערכת השבית את החשבון. יש לפנות למנהל המועדון לצורך הפעלה מחדש.</p>
        <button className="button button-secondary" onClick={logout}>התנתקות</button>
      </section>
    </main>
  );
}

export default function App() {
  const { configured, user, profile, loading, profileLoading } = useAuth();

  if (!configured) return <ConfigMissing />;
  if (loading || profileLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  if (!profile) return <BootstrapPage />;
  if (profile.active === false) return <InactiveAccount />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/:groupId" element={<GroupDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="children" element={<AdminRoute><ChildrenPage /></AdminRoute>} />
          <Route path="payments" element={<AdminRoute><PaymentsPage /></AdminRoute>} />
          <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
