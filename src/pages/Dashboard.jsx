import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon } from '../components/ui'
import { fmt, fmtDate, nights, STATUS, PAYMENT } from '../lib/utils'
import { DunningModal, BirthdayMailModal } from '../components/Invoice'

export default function Dashboard() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dunningModal, setDunningModal] = useState(null)
  const [birthdayModal, setBirthdayModal] = useState(null)
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => { if (campground) load() }, [campground])

  const load = async () => {
    const cid = campground.id
    const [{ data: bookings }, { data: sites }, { data: guests }] = await Promise.all([
      supabase.from('bookings').select('*').eq('campground_id', cid).order('arrival'),
      supabase.from('sites').select('*').eq('campground_id', cid),
      supabase.from('guests').select('*').eq('campground_id', cid),
    ])
    setData({ bookings: bookings || [], sites: sites || [], guests: guests || [] })
    setLoading(false)
  }

  if (loading || !data) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  const { bookings, sites, guests } = data
  const activeBookings  = bookings.filter(b => ['confirmed','arrived'].includes(b.status))
  const occupied        = sites.filter(s => s.status === 'occupied').length
  const totalFree       = sites.filter(s => s.status !== 'blocked').length
  const todayArrivals   = bookings.filter(b => b.arrival === todayStr)
  const todayDepartures = bookings.filter(b => b.departure === todayStr)
  const revenue  = bookings.filter(b => b.payment === 'paid').reduce((a, c) => a + Number(c.total), 0)
  const pending  = bookings.filter(b => b.payment === 'pending').reduce((a, c) => a + Number(c.total), 0)
  const pendingReq = bookings.filter(b => b.status === 'pending').length

  // Mahnungen: Zahlung offen seit > 14 Tagen, nicht storniert/abgereist
  const overdue = bookings.filter(b => {
    if (!['pending'].includes(b.payment)) return false
    if (['cancelled','departed'].includes(b.status)) return false
    const days = Math.floor((Date.now() - new Date(b.created_at)) / 86400000)
    return days >= 14
  })

  // Geburtstage: heute + nächste 7 Tage
  const todayMD = todayStr.slice(5) // MM-DD
  const birthdayGuests = guests.filter(g => {
    if (!g.birth_date) return false
    const gMD = g.birth_date.slice(5)
    // Vergleiche Monat-Tag in einem 7-Tage-Fenster
    for (let i = 0; i <= 7; i++) {
      const d = new Date(Date.now() + i * 86400000)
      const dMD = d.toISOString().slice(5, 10)
      if (gMD === dMD) return true
    }
    return false
  }).map(g => {
    const gMD = g.birth_date.slice(5)
    const isToday = gMD === todayMD
    const daysUntil = isToday ? 0 : (() => {
      for (let i = 1; i <= 7; i++) {
        const d = new Date(Date.now() + i * 86400000)
        if (d.toISOString().slice(5, 10) === gMD) return i
      }
      return 99
    })()
    return { ...g, isToday, daysUntil }
  }).sort((a, b) => a.daysUntil - b.daysUntil)

  const stats = [
    { label: 'Belegte Plätze', value: `${occupied}/${totalFree}`,
      sub: `${totalFree > 0 ? Math.round(occupied/totalFree*100) : 0}% Auslastung`,
      bg: '#D8F3DC', ic: '#2D6A4F', icon: 'tent' },
    { label: 'Aktive Buchungen', value: activeBookings.length,
      sub: `${pendingReq} Anfrage${pendingReq !== 1 ? 'n' : ''} offen`,
      bg: '#DBEAFE', ic: '#1D4ED8', icon: 'bookings' },
    { label: 'Einnahmen', value: fmt(revenue),
      sub: `${fmt(pending)} ausstehend`,
      bg: '#FEF3C7', ic: '#92400E', icon: 'pricing', small: true },
    { label: 'Anreisen heute', value: todayArrivals.length,
      sub: 'Heute erwartet',
      bg: '#D8F3DC', ic: '#2D6A4F', icon: 'calendar' },
    { label: 'Abreisen heute', value: todayDepartures.length,
      sub: 'Heute abreisend',
      bg: '#FCE7F3', ic: '#9D174D', icon: 'calendar' },
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

      {/* Mahnungen + Geburtstage (nur wenn vorhanden) */}
      {(overdue.length > 0 || birthdayGuests.length > 0) && (
        <div className="grid-2" style={{ marginBottom: 0 }}>

          {/* Mahnungen */}
          {overdue.length > 0 && (
            <div className="card" style={{ border: '1px solid #FCD34D' }}>
              <div className="card-header">
                <div className="card-title">⚠️ Offene Zahlungen</div>
                <span className="badge badge-amber">{overdue.length}</span>
              </div>
              <div style={{ padding: '0 20px' }}>
                {overdue.slice(0, 5).map(b => {
                  const days = Math.floor((Date.now() - new Date(b.created_at)) / 86400000)
                  return (
                    <div className="arrival-row" key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/buchungen/' + b.id)}>
                      <Avatar name={b.guest_name} size={34} />
                      <div className="arrival-info">
                        <div className="arrival-name">{b.guest_name}</div>
                        <div className="arrival-detail">Platz {b.site_name} · {days} Tage offen</div>
                      </div>
                      <div className="arrival-meta">
                        <div className="amount" style={{ color: '#92400E' }}>{fmt(b.total)}</div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={e => { e.stopPropagation(); setDunningModal(b) }}
                          style={{ marginTop: 4 }}
                        >
                          <Icon name="mail" size={12} /> Mahnung
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Geburtstage */}
          {birthdayGuests.length > 0 && (
            <div className="card" style={{ border: '1px solid #F9A8D4' }}>
              <div className="card-header">
                <div className="card-title">🎂 Geburtstage</div>
                <span className="badge" style={{ background: '#FCE7F3', color: '#9D174D' }}>{birthdayGuests.length}</span>
              </div>
              <div style={{ padding: '0 20px' }}>
                {birthdayGuests.map(g => (
                  <div className="arrival-row" key={g.id}>
                    <Avatar name={g.name} size={34} />
                    <div className="arrival-info">
                      <div className="arrival-name">{g.name}</div>
                      <div className="arrival-detail">
                        {g.isToday ? '🎉 Heute Geburtstag!' : `In ${g.daysUntil} Tag${g.daysUntil !== 1 ? 'en' : ''}`}
                        {g.birth_date && ` · ${new Date(g.birth_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`}
                      </div>
                    </div>
                    <div className="arrival-meta">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setBirthdayModal(g)}
                      >
                        <Icon name="mail" size={12} /> Glückwunsch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anreisen + Abreisen + Buchungen */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">✈️ Anreisen heute</div>
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
            <div className="card-title">🏠 Abreisen heute</div>
            <span className="badge badge-amber">{todayDepartures.length}</span>
          </div>
          <div style={{ padding: '0 20px' }}>
            {todayDepartures.length === 0
              ? <div className="empty-state" style={{ padding: 32 }}><p>Keine Abreisen heute</p></div>
              : todayDepartures.map(b => (
                <div className="arrival-row" key={b.id} onClick={() => navigate('/buchungen/' + b.id)} style={{ cursor: 'pointer' }}>
                  <Avatar name={b.guest_name} size={34} />
                  <div className="arrival-info">
                    <div className="arrival-name">{b.guest_name}</div>
                    <div className="arrival-detail">Platz {b.site_name} · {nights(b.arrival, b.departure)} Nächte</div>
                  </div>
                  <div className="arrival-meta">
                    <span className={`badge ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label}</span>
                    <div className="amount">{fmt(b.total)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
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
        <div /> {/* Platzhalter */}
      </div>

      {dunningModal && (
        <DunningModal booking={dunningModal} campground={campground} onClose={() => setDunningModal(null)} />
      )}
      {birthdayModal && (
        <BirthdayMailModal guest={birthdayModal} campground={campground} onClose={() => setBirthdayModal(null)} />
      )}
    </div>
  )
}
