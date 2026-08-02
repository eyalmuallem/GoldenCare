import {
  CalendarCheck2,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const adminLinks = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: '/groups', label: 'קבוצות', icon: UsersRound },
  { to: '/children', label: 'מתאמנים', icon: Users },
  { to: '/payments', label: 'תשלומים', icon: CreditCard },
  { to: '/attendance', label: 'נוכחות', icon: CalendarCheck2 },
  { to: '/users', label: 'משתמשים והרשאות', icon: ShieldCheck },
];

const coachLinks = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: '/groups', label: 'הקבוצות שלי', icon: UsersRound },
  { to: '/attendance', label: 'נוכחות', icon: CalendarCheck2 },
];

export default function Layout() {
  const { profile, organization, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = isAdmin ? adminLinks : coachLinks;

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="icon-button" type="button" onClick={() => setMenuOpen(true)} aria-label="פתיחת תפריט">
          <Menu size={23} />
        </button>
        <div className="mobile-brand">
          <strong>GoldenCare</strong>
          <small>{organization?.name || ''}</small>
        </div>
      </header>

      {menuOpen ? <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} /> : null}

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">GC</div>
          <div>
            <strong>GoldenCare</strong>
            <small>{organization?.name || 'ניהול מועדון ספורט'}</small>
          </div>
          <button className="icon-button mobile-only" type="button" onClick={() => setMenuOpen(false)} aria-label="סגירה">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={19} />
              <span>{label}</span>
              <ChevronLeft className="nav-chevron" size={16} />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{profile?.displayName?.slice(0, 1) || 'מ'}</div>
          <div>
            <strong>{profile?.displayName}</strong>
            <small>{isAdmin ? 'מנהל מערכת' : 'מאמן'}</small>
          </div>
          <button className="icon-button" type="button" onClick={handleLogout} aria-label="התנתקות">
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
