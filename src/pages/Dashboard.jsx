import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon } from '../components/ui'
import { fmt, fmtDate, nights, STATUS, PAYMENT } from '../lib/utils'
import { DunningModal, BirthdayMailModal } from '../components/Invoice'

// ─── Alle verfügbaren Blöcke ─────────────────────────────────────────────────
const ALL_BLOCKS = [
  'stats', 'alerts', 'arrivals', 'departures', 'active_bookings',
]
const BLOCK_LABELS = {
  stats:           'Kennzahlen (Statistikleiste)',
  alerts:          'Offene Zahlungen & Geburtstage',
  arrivals:        'Anreisen heute',
  departures:      'Abreisen heute',
  active_bookings: 'Aktuelle Buchungen',
}
const STORAGE_KEY = 'dashboard_layout_v1'

const loadLayout = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || ALL_BLOCKS } catch { return ALL_BLOCKS }
}
const saveLayout = (layout) => localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))

// ─── Einzelner Drag-fähiger Block-Wrapper ────────────────────────────────────
function DraggableBlock({ id, index, editMode, onDrop, onRemove, children }) {
  const dragRef = useRef(null)

  const onDragStart = (e) => {
    e.dataTransfer.setData('text/plain', index)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { if (dragRef.current) dragRef.current.style.opacity = '0.4' }, 0)
  }
  const onDragEnd = () => { if (dragRef.current) dragRef.current.style.opacity = '1' }
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const onDropHere = (e) => {
    e.preventDefault()
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (fromIdx !== index) onDrop(fromIdx, index)
  }

  return (
    <div
      ref={dragRef}
      draggable={editMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDropHere}
      style={{
        position: 'relative',
        cursor: editMode ? 'grab' : 'default',
        transition: 'outline .15s',
        outline: editMode ? '2px dashed var(--green-300)' : 'none',
        borderRadius: 14,
      }}
    >
      {editMode && (
        <div style={{
          position: 'absolute', top: -10, right: -10, zIndex: 20,
          display: 'flex', gap: 5,
        }}>
          <div style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
            padding: '3px 8px', fontSize: 11, color: 'var(--text-muted)', userSelect: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,.1)',
          }}>⠿ ziehen</div>
          <button
            onClick={() => onRemove(id)}
            style={{ width: 24, height: 24, borderRadius: '50%', background: '#EF4444', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            title={`„${BLOCK_LABELS[id]}" entfernen`}
          >✕</button>
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dunningModal, setDunningModal]   = useState(null)
  const [birthdayModal, setBirthdayModal] = useState(null)
  const [editMode, setEditMode]   = useState(false)
  const [layout, setLayout]       = useState(loadLayout)
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => { if (campground) load() }, [campground]) // eslint-disable-line

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

  const handleDrop = useCallback((fromIdx, toIdx) => {
    setLayout(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      saveLayout(next)
      return next
    })
  }, [])

  const handleRemove = useCallback((id) => {
    setLayout(prev => {
      const next = prev.filter(b => b !== id)
      saveLayout(next)
      return next
    })
  }, [])

  const handleRestore = (id) => {
    setLayout(prev => {
      const next = [...prev, id]
      saveLayout(next)
      return next
    })
  }

  const resetLayout = () => { saveLayout(ALL_BLOCKS); setLayout(ALL_BLOCKS) }

  if (loading || !data) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  const { bookings, sites, guests } = data
  const activeBookings  = bookings.filter(b => ['confirmed','arrived'].includes(b.status))
  const occupied        = sites.filter(s => s.status === 'occupied').length
  const totalFree       = sites.filter(s => s.status !== 'blocked').length
  const todayArrivals   = bookings.filter(b => b.arrival === todayStr)
  const todayDepartures = bookings.filter(b => b.departure === todayStr)
  const revenue         = bookings.filter(b => b.payment === 'paid').reduce((a, c) => a + Number(c.total), 0)
  const pending         = bookings.filter(b => b.payment === 'pending').reduce((a, c) => a + Number(c.total), 0)
  const pendingReq      = bookings.filter(b => b.status === 'pending').length

  const overdue = bookings.filter(b => {
    if (b.payment !== 'pending') return false
    if (['cancelled','departed'].includes(b.status)) return false
    return Math.floor((Date.now() - new Date(b.created_at)) / 86400000) >= 14
  })

  const todayMD = todayStr.slice(5)
  const birthdayGuests = guests.filter(g => {
    if (!g.birth_date) return false
    for (let i = 0; i <= 7; i++) {
      const d = new Date(Date.now() + i * 86400000)
      if (g.birth_date.slice(5) === d.toISOString().slice(5, 10)) return true
    }
    return false
  }).map(g => {
    const gMD = g.birth_date.slice(5)
    const isToday = gMD === todayMD
    const daysUntil = isToday ? 0 : (() => {
      for (let i = 1; i <= 7; i++) {
        if (new Date(Date.now() + i * 86400000).toISOString().slice(5, 10) === gMD) return i
      }
      return 99
    })()
    return { ...g, isToday, daysUntil }
  }).sort((a, b) => a.daysUntil - b.daysUntil)

  const stats = [
    { label: 'Belegte Plätze', value: `${occupied}/${totalFree}`, sub: `${totalFree > 0 ? Math.round(occupied/totalFree*100) : 0}% Auslastung`, bg: '#D8F3DC', ic: '#2D6A4F', icon: 'tent' },
    { label: 'Aktive Buchungen', value: activeBookings.length, sub: `${pendingReq} Anfrage${pendingReq !== 1 ? 'n' : ''} offen`, bg: '#DBEAFE', ic: '#1D4ED8', icon: 'bookings' },
    { label: 'Einnahmen', value: fmt(revenue), sub: `${fmt(pending)} ausstehend`, bg: '#FEF3C7', ic: '#92400E', icon: 'pricing', small: true },
    { label: 'Anreisen heute', value: todayArrivals.length, sub: 'Heute erwartet', bg: '#D8F3DC', ic: '#2D6A4F', icon: 'calendar' },
    { label: 'Abreisen heute', value: todayDepartures.length, sub: 'Heute abreisend', bg: '#FCE7F3', ic: '#9D174D', icon: 'calendar' },
  ]

  const hidden = ALL_BLOCKS.filter(b => !layout.includes(b))

  // ─── Block-Renderer ────────────────────────────────────────────────────────
  const renderBlock = (id, index) => {
    const wrap = (content) => (
      <DraggableBlock key={id} id={id} index={index} editMode={editMode} onDrop={handleDrop} onRemove={handleRemove}>
        {content}
      </DraggableBlock>
    )

    if (id === 'stats') return wrap(
      <div className="stats-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.bg, color: s.ic }}><Icon name={s.icon} size={17} /></div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: s.small ? '20px' : undefined }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
    )

    if (id === 'alerts') {
      if (!editMode && overdue.length === 0 && birthdayGuests.length === 0) return null
      return wrap(
        <div className="grid-2">
          {(overdue.length > 0 || editMode) && (
            <div className="card" style={{ border: '1px solid #FCD34D', opacity: overdue.length === 0 ? 0.4 : 1 }}>
              <div className="card-header">
                <div className="card-title">⚠️ Offene Zahlungen</div>
                <span className="badge badge-amber">{overdue.length}</span>
              </div>
              <div style={{ padding: '0 20px' }}>
                {overdue.length === 0
                  ? <div className="empty-state" style={{ padding: 24 }}><p style={{ fontSize: 13 }}>Keine offenen Zahlungen</p></div>
                  : overdue.slice(0, 5).map(b => {
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
                          <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }}
                            onClick={e => { e.stopPropagation(); setDunningModal(b) }}>
                            <Icon name="mail" size={12} /> Mahnung
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
          {(birthdayGuests.length > 0 || editMode) && (
            <div className="card" style={{ border: '1px solid #F9A8D4', opacity: birthdayGuests.length === 0 ? 0.4 : 1 }}>
              <div className="card-header">
                <div className="card-title">🎂 Geburtstage</div>
                <span className="badge" style={{ background: '#FCE7F3', color: '#9D174D' }}>{birthdayGuests.length}</span>
              </div>
              <div style={{ padding: '0 20px' }}>
                {birthdayGuests.length === 0
                  ? <div className="empty-state" style={{ padding: 24 }}><p style={{ fontSize: 13 }}>Keine Geburtstage bald</p></div>
                  : birthdayGuests.map(g => (
                    <div className="arrival-row" key={g.id}>
                      <Avatar name={g.name} size={34} />
                      <div className="arrival-info">
                        <div className="arrival-name">{g.name}</div>
                        <div className="arrival-detail">
                          {g.isToday ? '🎉 Heute!' : `In ${g.daysUntil} Tag${g.daysUntil !== 1 ? 'en' : ''}`}
                          {g.birth_date && ` · ${new Date(g.birth_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`}
                        </div>
                      </div>
                      <div className="arrival-meta">
                        <button className="btn btn-secondary btn-sm" onClick={() => setBirthdayModal(g)}>
                          <Icon name="mail" size={12} /> Glückwunsch
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (id === 'arrivals') return wrap(
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
    )

    if (id === 'departures') return wrap(
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
    )

    if (id === 'active_bookings') return wrap(
      <div className="card">
        <div className="card-header">
          <div className="card-title">Aktuelle Buchungen</div>
          <span className="badge badge-blue">{activeBookings.length}</span>
        </div>
        <div style={{ padding: '0 20px' }}>
          {activeBookings.length === 0
            ? <div className="empty-state" style={{ padding: 32 }}><p>Keine aktiven Buchungen</p></div>
            : activeBookings.slice(0, 6).map(b => (
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
        </div>
      </div>
    )

    return null
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="page-actions">
          {editMode && hidden.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hinzufügen:</span>
              {hidden.map(id => (
                <button key={id} className="btn btn-secondary btn-sm" onClick={() => handleRestore(id)}>
                  + {BLOCK_LABELS[id]}
                </button>
              ))}
            </div>
          )}
          {editMode && (
            <button className="btn btn-secondary btn-sm" onClick={resetLayout} title="Alle Blöcke zurücksetzen">
              ↺ Zurücksetzen
            </button>
          )}
          <button
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setEditMode(v => !v)}
          >
            {editMode
              ? <><Icon name="check" size={13} /> Fertig</>
              : <><Icon name="edit" size={13} /> Ansicht bearbeiten</>}
          </button>
        </div>
      </div>

      {/* Edit-Modus Hinweis */}
      {editMode && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#78350F' }}>
          <strong>Bearbeitungsmodus:</strong> Blöcke per Drag & Drop verschieben · ✕ zum Entfernen · Oben entfernte Blöcke wieder hinzufügen
        </div>
      )}

      {/* Gerenderte Blöcke */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: editMode ? 20 : 0 }}>
        {layout.map((id, i) => renderBlock(id, i))}
      </div>

      {dunningModal && <DunningModal booking={dunningModal} campground={campground} onClose={() => setDunningModal(null)} />}
      {birthdayModal && <BirthdayMailModal guest={birthdayModal} campground={campground} onClose={() => setBirthdayModal(null)} />}
    </div>
  )
}
