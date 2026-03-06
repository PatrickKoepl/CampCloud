import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Icon, Avatar } from '../components/ui'
import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',             label: 'Dashboard',    icon: 'dashboard' },
  { to: '/zeitplan',     label: 'Zeitplan',     icon: 'calendar' },
  { to: '/buchungen',    label: 'Buchungen',    icon: 'bookings', badge: true },
  { to: '/stellplaetze', label: 'Stellplätze',  icon: 'sites' },
  { to: '/gaeste',       label: 'Gäste',        icon: 'guests' },
  { to: '/rechnungen',   label: 'Rechnungen',   icon: 'invoice' },
  { to: '/preislisten',  label: 'Preislisten',  icon: 'pricing' },
]

const getTitle = (p) => {
  if (p === '/' || p === '')      return 'Dashboard'
  if (p.startsWith('/zeitplan'))  return 'Zeitplan'
  if (p.startsWith('/buchungen')) return 'Buchungen'
  if (p.startsWith('/stellplaetze')) return 'Stellplätze'
  if (p.startsWith('/gaeste'))    return 'Gäste'
  if (p.startsWith('/rechnungen'))return 'Rechnungen'
  if (p.startsWith('/preislisten'))return 'Preislisten'
  if (p.startsWith('/einstellungen'))return 'Einstellungen'
  return 'CampCloud'
}

export default function Layout({ pendingCount }) {
  const { campground, refreshCampground, signOut } = useAuth()
  const location = useLocation()
  const title = getTitle(location.pathname)
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const logoUrl = campground?.logo_url || null

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !campground) return
    setUploading(true)

    // Datei in Supabase Storage hochladen
    const ext  = file.name.split('.').pop()
    const path = `logos/${campground.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('campground-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) { alert('Upload fehlgeschlagen: ' + upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage
      .from('campground-assets')
      .getPublicUrl(path)

    // URL in campgrounds speichern
    await supabase.from('campgrounds').update({ logo_url: publicUrl + '?t=' + Date.now() }).eq('id', campground.id)
    await refreshCampground()
    setUploading(false)
  }

  const removeLogo = async () => {
    if (!confirm('Logo entfernen?')) return
    await supabase.from('campgrounds').update({ logo_url: null }).eq('id', campground.id)
    await refreshCampground()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          {/* Logo-Bereich */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {logoUrl ? (
              <div style={{ position: 'relative' }} className="sidebar-logo-img-wrap">
                <img
                  src={logoUrl}
                  alt="Logo"
                  style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.15)' }}
                  onClick={() => fileRef.current?.click()}
                  title="Logo ändern"
                />
                <button
                  onClick={removeLogo}
                  style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', border: '1.5px solid #1B4332', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  title="Logo entfernen"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                title="Logo hochladen"
                disabled={uploading}
                style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1.5px dashed rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {uploading ? '…' : '+'}
              </button>
            )}
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: "'Sora',sans-serif", letterSpacing: '-0.3px' }}>
              ⛺ Camp<span style={{ color: 'var(--green-600)' }}>Cloud</span>
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{campground?.name ?? 'Campingplatz'}</p>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        <nav className="nav-section">
          <div className="nav-label">Verwaltung</div>
          {NAV.map(({ to, label, icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon name={icon} size={16} />
              {label}
              {badge && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="nav-spacer" />

        <div className="nav-section">
          <NavLink to="/einstellungen" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
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
        <div className="page-scroll"><Outlet /></div>
      </div>
    </div>
  )
}
