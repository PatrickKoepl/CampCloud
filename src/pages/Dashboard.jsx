import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon } from '../components/ui'
import { fmt, fmtDate, nights, STATUS, PAYMENT } from '../lib/utils'

export default function Dashboard() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!campground) return
    load()
  }, [campground])

  const load = async () => {
    const cid = campground.id
    const [{ data: bookings }, { data: sites }] = await Promise.all([
      supabase.from('bookings').select('*').eq('campground_id', cid).order('arrival'),
      supabase.from('sites').select('*').eq('campground_id', cid),
    ])
    setData({ bookings: bookings || [], sites: sites || [] })
    setLoading(false)
  }

  if (loading || !data) return (
    <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>
  )

  const { bookings, sites } = data
  const activeBookings = bookings.filter(b => ['confirmed','arrived'].includes(b.status))
  const occupied  = sites.filter(s => s.status === 'occupied').length
  const totalFree = sites.filter(s => s.status !== 'blocked').length
  const todayArrivals   = bookings.filter(b => b.arrival === todayStr)
  const todayDepartures = bookings.filter(b => b.departure === todayStr)
  const revenue = bookings.filter(b => b.payment === 'paid').reduce((a, c) => a + Number(c.total), 0)
  const pending = bookings.filter(b => b.payment === 'pending').reduce((a, c) => a + Number(c.total), 0)
  const pendingReq = bookings.filter(b => b.status === 'pending').length

  const stats = [
    {
      label: 'Belegte Plätze', value: `${occupied}/${totalFree}`,
      sub: `${totalFree > 0 ? Math.round(occupied / totalFree * 100) : 0}% Auslastung`,
      bg: '#D8F3DC', ic: '#2D6A4F', icon: 'tent',
    },
    {
      label: 'Aktive Buchungen', value: activeBookings.length,
      sub: `${pendingReq} Anfrage${pendingReq !== 1 ? 'n' : ''} offen`,
      bg: '#DBEAFE', ic: '#1D4ED8', icon: 'bookings',
    },
    {
      label: 'Einnahmen', value: fmt(revenue),
      sub: `${fmt(pending)} ausstehend`,
      bg: '#FEF3C7', ic: '#92400E', icon: 'pricing', small: true,
    },
    {
      label: 'Anreisen heute', value: todayArrivals.length,
      sub: `${todayDepartures.length} Abreise${todayDepartures.length !== 1 ? 'n' : ''} heute`,
      bg: '#FCE7F3', ic: '#9D174D', icon: 'calendar',
    },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.bg, color: s.ic }}>
              <Icon name={s.icon} size={17} />
            </div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: s.small ? '20px' : undefined }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-col bottom */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Anreisen heute</div>
            <span className="badge badge-green">{todayArrivals.length}</span>
          </div>
          <div style={{ padding: '0 20px' }}>
            {todayArrivals.length === 0
              ? <div className="empty-state" style={{ padding: 32 }}><p>Keine Anreisen heute</p></div>
              : todayArrivals.map(b => (
                <div className="arrival-row" key={b.id} onClick={() => navigate('/buchungen/' + b.id)} style={{ cursor: 'pointer' }}>
                  <Avatar name={b.guest_name} size={34} />
                  <div className="arrival-info">
                    <div className="arrival-name">{b.guest_name}</div>
                    <div className="arrival-detail">Platz {b.site_name} · {b.persons} Pers. · {nights(b.arrival, b.departure)} Nächte</div>
                  </div>
                  <div className="arrival-meta">
                    <span className={`badge ${PAYMENT[b.payment]?.cls}`}>{PAYMENT[b.payment]?.label}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Aktuelle Buchungen</div>
            <span className="badge badge-blue">{activeBookings.length}</span>
          </div>
          <div style={{ padding: '0 20px' }}>
            {activeBookings.slice(0, 6).map(b => (
              <div className="arrival-row" key={b.id} onClick={() => navigate('/buchungen/' + b.id)} style={{ cursor: 'pointer' }}>
                <Avatar name={b.guest_name} size={34} />
                <div className="arrival-info">
                  <div className="arrival-name">{b.guest_name}</div>
                  <div className="arrival-detail">{b.site_name} · {fmtDate(b.arrival)} – {fmtDate(b.departure)}</div>
                </div>
                <div className="arrival-meta">
                  <span className={`badge ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label}</span>
                  <div className="amount">{fmt(b.total)}</div>
                </div>
              </div>
            ))}
            {activeBookings.length === 0 && (
              <div className="empty-state" style={{ padding: 32 }}><p>Keine aktiven Buchungen</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
