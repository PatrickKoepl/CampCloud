import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Icon } from '../components/ui'
import { fmtDate } from '../lib/utils'

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
const isoDate = (d) => d.toISOString().slice(0, 10)

const addDays = (dateStr, n) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

const daysBetween = (a, b) => {
  const da = new Date(a), db = new Date(b)
  return Math.round((db - da) / 86400000)
}

// Wochentag-Kürzel
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONTH_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// Farben für Buchungen (nach Hash des Gastnamens — deterministisch)
const BOOKING_COLORS = [
  { bg: '#2D6A4F', text: '#fff' },
  { bg: '#1D4ED8', text: '#fff' },
  { bg: '#9D174D', text: '#fff' },
  { bg: '#92400E', text: '#fff' },
  { bg: '#065F46', text: '#fff' },
  { bg: '#1E3A5F', text: '#fff' },
  { bg: '#7C3AED', text: '#fff' },
  { bg: '#B45309', text: '#fff' },
]

const colorFor = (str) => {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return BOOKING_COLORS[h % BOOKING_COLORS.length]
}

const STATUS_BG = { free: '#F0FDF4', occupied: '#FEF3C7', blocked: '#F3F4F6' }

// Anzahl Tage im Fenster
const WINDOW_DAYS = 28

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Timeline() {
  const { campground } = useAuth()
  const navigate       = useNavigate()
  const scrollRef      = useRef(null)

  const [sites, setSites]       = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [startDate, setStartDate] = useState(() => {
    // Montag der aktuellen Woche
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return isoDate(d)
  })
  const [areaFilter, setAreaFilter] = useState('all')
  const [hoverBooking, setHoverBooking] = useState(null)
  const [tooltip, setTooltip] = useState(null) // { booking, x, y }

  const load = useCallback(async () => {
    if (!campground) return
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from('sites').select('*').eq('campground_id', campground.id).order('area').order('name'),
      supabase.from('bookings')
        .select('id, booking_number, guest_id, guest_name, site_id, site_name, arrival, departure, status, payment, total, persons')
        .eq('campground_id', campground.id)
        .not('status', 'in', '("cancelled")')
        .order('arrival'),
    ])
    setSites(s || [])
    setBookings(b || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  // Tages-Array für das aktuelle Fenster
  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < WINDOW_DAYS; i++) arr.push(addDays(startDate, i))
    return arr
  }, [startDate])

  const endDate = days[days.length - 1]

  // Buchungen pro Site im aktuellen Fenster
  const bookingsBySite = useMemo(() => {
    const map = {}
    bookings.forEach(b => {
      // Überschneidet sich mit aktuellem Fenster?
      if (b.departure <= startDate || b.arrival > endDate) return
      const key = b.site_id || b.site_name
      if (!map[key]) map[key] = []
      map[key].push(b)
    })
    return map
  }, [bookings, startDate, endDate])

  // Heute
  const todayStr = isoDate(new Date())

  // Bereiche für Filter
  const areas = useMemo(() => [...new Set(sites.map(s => s.area))].sort(), [sites])
  const filteredSites = useMemo(() =>
    areaFilter === 'all' ? sites : sites.filter(s => s.area === areaFilter),
    [sites, areaFilter]
  )

  // Navigation
  const goToday = () => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    setStartDate(isoDate(d))
  }

  const CELL_W = 38  // px pro Tag
  const LABEL_W = 140  // px Seitenbereich

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Zeitplan</div>
          <div className="page-subtitle">
            {fmtDate(startDate)} – {fmtDate(endDate)} · {filteredSites.length} Stellplätze
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setStartDate(s => addDays(s, -WINDOW_DAYS))}>
            <Icon name="back" size={14} /> Zurück
          </button>
          <button className="btn btn-secondary" onClick={goToday}>
            Heute
          </button>
          <button className="btn btn-secondary" onClick={() => setStartDate(s => addDays(s, WINDOW_DAYS))}>
            Weiter <Icon name="forward" size={14} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="filter-sel" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
          <option value="all">Alle Bereiche</option>
          {areas.map(a => <option key={a} value={a}>Bereich {a}</option>)}
        </select>
        {/* Legende */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, marginLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#2D6A4F' }} />
            <span style={{ color: 'var(--text-muted)' }}>Belegt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#F0FDF4', border: '1px solid #D1FAE5' }} />
            <span style={{ color: 'var(--text-muted)' }}>Frei</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#F3F4F6', border: '1px solid #E5E7EB' }} />
            <span style={{ color: 'var(--text-muted)' }}>Gesperrt</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }} ref={scrollRef}>
          <div style={{ minWidth: LABEL_W + CELL_W * WINDOW_DAYS + 2, position: 'relative' }}>

            {/* ── Header: Monate ── */}
            <div style={{
              display: 'flex', position: 'sticky', top: 0, zIndex: 30,
              background: 'var(--card)', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '2px solid var(--border)' }} />
              {/* Monats-Gruppen */}
              {(() => {
                const groups = []
                let cur = null, count = 0
                days.forEach(d => {
                  const m = d.slice(0, 7)
                  if (m !== cur) {
                    if (cur !== null) groups.push({ label: cur, count })
                    cur = m; count = 1
                  } else count++
                })
                if (cur) groups.push({ label: cur, count })
                return groups.map(g => {
                  const [y, m] = g.label.split('-')
                  return (
                    <div key={g.label} style={{
                      width: g.count * CELL_W, flexShrink: 0,
                      borderRight: '1px solid var(--border)',
                      padding: '4px 8px', fontSize: 11, fontWeight: 700,
                      color: 'var(--green-900)', textTransform: 'uppercase', letterSpacing: '.5px',
                      background: 'var(--green-100)',
                    }}>
                      {MONTH_SHORT[Number(m) - 1]} {y}
                    </div>
                  )
                })
              })()}
            </div>

            {/* ── Header: Tage ── */}
            <div style={{
              display: 'flex', position: 'sticky', top: 28, zIndex: 30,
              background: 'var(--card)', borderBottom: '2px solid var(--border)',
            }}>
              <div style={{
                width: LABEL_W, flexShrink: 0,
                padding: '5px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.5px', borderRight: '2px solid var(--border)',
              }}>
                Stellplatz
              </div>
              {days.map(d => {
                const isToday = d === todayStr
                const dayNum  = new Date(d + 'T12:00:00').getDay()
                const isWE    = dayNum === 0 || dayNum === 6
                return (
                  <div key={d} style={{
                    width: CELL_W, flexShrink: 0, textAlign: 'center',
                    padding: '3px 0', fontSize: 11, lineHeight: 1.3,
                    borderRight: '1px solid var(--border)',
                    background: isToday ? '#1B4332' : isWE ? '#F8FAFC' : 'var(--card)',
                    color: isToday ? '#fff' : isWE ? 'var(--text-muted)' : 'var(--text)',
                    fontWeight: isToday ? 700 : 400,
                  }}>
                    <div style={{ fontSize: 9 }}>{DAY_SHORT[dayNum]}</div>
                    <div style={{ fontWeight: 600 }}>{d.slice(8)}</div>
                  </div>
                )
              })}
            </div>

            {/* ── Zeilen: Bereiche + Stellplätze ── */}
            {(() => {
              let lastArea = null
              return filteredSites.map(site => {
                const siteBookings = bookingsBySite[site.id] || []
                const areaHeader = site.area !== lastArea ? (lastArea = site.area, true) : false

                return (
                  <div key={site.id}>
                    {/* Bereichs-Trenner */}
                    {areaHeader && (
                      <div style={{
                        display: 'flex', borderBottom: '1px solid var(--border)',
                        background: '#F8FAFC',
                      }}>
                        <div style={{
                          width: LABEL_W + CELL_W * WINDOW_DAYS, flexShrink: 0,
                          padding: '4px 14px', fontSize: 11, fontWeight: 700,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px',
                        }}>
                          Bereich {site.area}
                        </div>
                      </div>
                    )}

                    {/* Stellplatz-Zeile */}
                    <div style={{
                      display: 'flex', borderBottom: '1px solid var(--border)',
                      height: 40, position: 'relative',
                    }}>
                      {/* Label */}
                      <div style={{
                        width: LABEL_W, flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0 12px', borderRight: '2px solid var(--border)',
                        position: 'sticky', left: 0, background: 'var(--card)', zIndex: 10,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                          background: site.status === 'free' ? '#2D6A4F' : site.status === 'blocked' ? '#9CA3AF' : '#D97706',
                        }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{site.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{site.type?.slice(0, 4)}</span>
                      </div>

                      {/* Tages-Zellen (Hintergrund) */}
                      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                        {days.map(d => {
                          const dayNum = new Date(d + 'T12:00:00').getDay()
                          const isWE   = dayNum === 0 || dayNum === 6
                          const isToday = d === todayStr
                          return (
                            <div key={d} style={{
                              width: CELL_W, flexShrink: 0, height: 40,
                              borderRight: '1px solid var(--border)',
                              background: isToday
                                ? 'rgba(27,67,50,0.06)'
                                : isWE ? '#FAFAFA' : 'transparent',
                            }} />
                          )
                        })}

                        {/* Buchungs-Blöcke (absolut über Zellen gelegt) */}
                        {siteBookings.map(b => {
                          // Clamp auf sichtbares Fenster
                          const visStart = b.arrival  < startDate ? startDate : b.arrival
                          const visEnd   = b.departure > addDays(endDate, 1) ? endDate : addDays(b.departure, -1)

                          const startOff = daysBetween(startDate, visStart)
                          const spanDays = daysBetween(visStart, visEnd) + 1

                          if (startOff < 0 || startOff >= WINDOW_DAYS) return null

                          const color  = colorFor(b.guest_name)
                          const left   = startOff * CELL_W
                          const width  = Math.max(1, Math.min(spanDays, WINDOW_DAYS - startOff)) * CELL_W - 2
                          const label  = b.guest_name + (b.booking_number ? ` #${b.booking_number}` : '')
                          const cutL   = b.arrival < startDate
                          const cutR   = b.departure > addDays(endDate, 1)

                          return (
                            <div
                              key={b.id}
                              onClick={() => navigate('/buchungen/' + b.id)}
                              onMouseEnter={e => {
                                setHoverBooking(b.id)
                                setTooltip({ booking: b, x: e.clientX, y: e.clientY })
                              }}
                              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                              onMouseLeave={() => { setHoverBooking(null); setTooltip(null) }}
                              style={{
                                position: 'absolute',
                                left: left + 1, top: 5,
                                width, height: 30,
                                background: color.bg,
                                borderRadius: `${cutL ? 0 : 5}px ${cutR ? 0 : 5}px ${cutR ? 0 : 5}px ${cutL ? 0 : 5}px`,
                                borderLeft:  cutL ? `3px solid rgba(255,255,255,0.5)` : 'none',
                                borderRight: cutR ? `3px solid rgba(255,255,255,0.5)` : 'none',
                                display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 4,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                boxShadow: hoverBooking === b.id
                                  ? `0 0 0 2px #fff, 0 0 0 3px ${color.bg}`
                                  : '0 1px 3px rgba(0,0,0,0.25)',
                                transition: 'box-shadow 0.1s',
                                zIndex: hoverBooking === b.id ? 20 : 5,
                              }}
                            >
                              <span style={{
                                color: color.text, fontSize: 11, fontWeight: 600,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}

            {filteredSites.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Keine Stellplätze vorhanden
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <BookingTooltip booking={tooltip.booking} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function BookingTooltip({ booking: b, x, y }) {
  const nights = Math.max(0, Math.round((new Date(b.departure) - new Date(b.arrival)) / 86400000))
  const fmt2 = (n) => `${Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  const color = colorFor(b.guest_name)

  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y - 10, zIndex: 9999,
      background: '#1A1A2E', color: '#fff',
      borderRadius: 10, padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      fontSize: 12.5, lineHeight: 1.7, minWidth: 220, maxWidth: 280,
      pointerEvents: 'none',
    }}>
      {/* Farbbalken */}
      <div style={{
        width: 32, height: 4, borderRadius: 2,
        background: color.bg, marginBottom: 8,
      }} />
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.guest_name}</div>
      <div style={{ color: '#AAB' }}>Platz {b.site_name}</div>
      {b.booking_number && <div style={{ color: '#AAB' }}>Buchung #{b.booking_number}</div>}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div>📅 {fmtDate(b.arrival)} → {fmtDate(b.departure)}</div>
        <div>🌙 {nights} Nacht{nights !== 1 ? 'e' : ''} · 👥 {b.persons} Person{b.persons !== 1 ? 'en' : ''}</div>
        {b.total > 0 && <div>💶 {fmt2(b.total)}</div>}
      </div>
    </div>
  )
}
