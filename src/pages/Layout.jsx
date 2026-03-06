import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Icon, Avatar } from '../components/ui'

const NAV = [
  { to: '/',            label: 'Dashboard',    icon: 'dashboard' },
  { to: '/zeitplan',    label: 'Zeitplan',     icon: 'calendar' },
  { to: '/buchungen',   label: 'Buchungen',    icon: 'bookings',  badge: true },
  { to: '/stellplaetze', label: 'Stellplätze', icon: 'sites' },
  { to: '/gaeste',      label: 'Gäste',        icon: 'guests' },
  { to: '/rechnungen',  label: 'Rechnungen',   icon: 'invoice' },
  { to: '/preislisten', label: 'Preislisten',  icon: 'pricing' },
]

const getTitle = (pathname) => {
  if (pathname === '/' || pathname === '')   return 'Dashboard'
  if (pathname.startsWith('/zeitplan'))      return 'Zeitplan'
  if (pathname.startsWith('/buchungen'))     return 'Buchungen'
  if (pathname.startsWith('/stellplaetze')) return 'Stellplätze'
  if (pathname.startsWith('/gaeste'))       return 'Gäste'
  if (pathname.startsWith('/rechnungen'))   return 'Rechnungen'
  if (pathname.startsWith('/preislisten'))  return 'Preislisten'
  if (pathname.startsWith('/einstellungen'))return 'Einstellungen'
  return 'CampCloud'
}

export default function Layout({ pendingCount }) {
  const { campground, signOut } = useAuth()
  const location = useLocation()
  const title = getTitle(location.pathname)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>⛺ Camp<span>Cloud</span></h1>
          <p>{campground?.name ?? 'Campingplatz'}</p>
        </div>

        <nav className="nav-section">
          <div className="nav-label">Verwaltung</div>
          {NAV.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={icon} size={16} />
              {label}
              {badge && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="nav-spacer" />

        <div className="nav-section">
          <NavLink
            to="/einstellungen"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon name="settings" size={16} /> Einstellungen
          </NavLink>
          <div className="nav-item" onClick={signOut} style={{ cursor: 'pointer' }}>
            <Icon name="logout" size={16} /> Abmelden
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{title}</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-camp">{campground?.name}</span>
            <Avatar name={campground?.name ?? 'C'} size={34} />
          </div>
        </header>

        <div className="page-scroll">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
