import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './ui'

// ─── Konstanten ───────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  free:     { bg: '#2D6A4F', border: '#1B4332', label: 'Frei' },
  occupied: { bg: '#D97706', border: '#92400E', label: 'Belegt' },
  blocked:  { bg: '#9CA3AF', border: '#6B7280', label: 'Gesperrt' },
}

const SYMBOLS = [
  { type: 'tree',       emoji: '🌲', label: 'Baum' },
  { type: 'shower',     emoji: '🚿', label: 'Dusche' },
  { type: 'toilet',     emoji: '🚽', label: 'Toilette' },
  { type: 'parking',    emoji: '🅿️', label: 'Parkplatz' },
  { type: 'reception',  emoji: '🏠', label: 'Rezeption' },
  { type: 'shop',       emoji: '🏪', label: 'Kiosk/Shop' },
  { type: 'power',      emoji: '⚡', label: 'Stromanschluss' },
  { type: 'water',      emoji: '💧', label: 'Wasseranschluss' },
  { type: 'fire',       emoji: '🔥', label: 'Feuerstelle' },
  { type: 'playground', emoji: '🛝', label: 'Spielplatz' },
  { type: 'trash',      emoji: '🗑️', label: 'Müll' },
  { type: 'road',       emoji: '🛤️', label: 'Zufahrt' },
  { type: 'tent_area',  emoji: '⛺', label: 'Zeltbereich' },
  { type: 'pool',       emoji: '🏊', label: 'Pool/See' },
  { type: 'dog',        emoji: '🐕', label: 'Hundewiese' },
  { type: 'wash',       emoji: '🧺', label: 'Waschmaschine' },
]
const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.type, s]))

// Flächentypen zum Zeichnen
const AREA_TYPES = [
  { type: 'grass',     label: 'Wiese',        fill: 'rgba(134,239,172,0.35)', stroke: 'rgba(34,197,94,0.7)',   strokeW: 2 },
  { type: 'path',      label: 'Weg/Straße',   fill: 'rgba(203,213,225,0.5)',  stroke: 'rgba(100,116,139,0.8)', strokeW: 2 },
  { type: 'water',     label: 'Wasser/See',   fill: 'rgba(147,197,253,0.45)', stroke: 'rgba(59,130,246,0.7)',  strokeW: 2 },
  { type: 'site_zone', label: 'Stellplatz-Fläche', fill: 'rgba(253,230,138,0.35)', stroke: 'rgba(217,119,6,0.6)', strokeW: 2 },
  { type: 'building',  label: 'Gebäude',      fill: 'rgba(209,213,219,0.6)',  stroke: 'rgba(107,114,128,0.9)', strokeW: 2 },
]
const AREA_MAP = Object.fromEntries(AREA_TYPES.map(a => [a.type, a]))

// ─── Marker-Popup ─────────────────────────────────────────────────────────────
function SitePopup({ site, pos, onClose, onStatusChange, onEdit, onDelete, onRemoveFromMap }) {
  const goLeft = pos.x > 60
  const hasBooking = site._hasBooking
  const isOnMap    = site.x_pos != null

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        [goLeft ? 'right' : 'left']: 'calc(100% + 10px)',
        top: '-10px',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        padding: '14px 16px',
        minWidth: 215,
        zIndex: 100,
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15 }}>{site.name}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 2 }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        {site.type}{site.size ? ` · ${site.size}` : ''}{site.electric ? ' · ⚡' : ''}{site.water ? ' · 💧' : ''}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <button key={s} onClick={() => onStatusChange(site, s)} style={{
            flex: 1, padding: '5px 2px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            border: `2px solid ${site.status === s ? c.border : 'transparent'}`,
            background: site.status === s ? c.bg : '#F3F4F6',
            color: site.status === s ? '#fff' : '#6B7280',
          }}>{c.label}</button>
        ))}
      </div>

      {/* Aktionen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button onClick={() => onEdit(site)} style={{
          width: '100%', padding: '7px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <Icon name="edit" size={12} /> Bearbeiten
        </button>

        {/* Von Karte entfernen — immer möglich wenn platziert */}
        <button onClick={() => onRemoveFromMap(site)} style={{
          width: '100%', padding: '7px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          border: '1px solid #FCD34D', background: '#FFFBEB', color: '#92400E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          📍 Von Karte entfernen
        </button>

        {/* Löschen — nur wenn keine Buchungen */}
        {hasBooking ? (
          <div style={{
            width: '100%', padding: '7px', borderRadius: 6, fontSize: 11,
            border: '1px solid #FECACA', background: '#FFF0F0', color: '#991B1B',
            textAlign: 'center', lineHeight: 1.4,
          }}>
            ⛔ Löschen nicht möglich<br />
            <span style={{ opacity: 0.8 }}>Stellplatz hat aktive Buchungen</span>
          </div>
        ) : (
          <button onClick={() => onDelete(site)} style={{
            width: '100%', padding: '7px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <Icon name="trash" size={12} /> Stellplatz löschen
          </button>
        )}
      </div>
    </div>
  )
}

// ─── SVG-Flächen ─────────────────────────────────────────────────────────────
function MapAreas({ areas, width, height, editMode, onDelete }) {
  if (!width || !height) return null
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: editMode ? 'none' : 'auto' }}
      viewBox={`0 0 100 100`}
      preserveAspectRatio="none"
    >
      {areas.map(area => {
        const cfg = AREA_MAP[area.area_type] || AREA_MAP.grass
        const pts = area.points
        if (!pts || pts.length < 2) return null
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
        return (
          <g key={area.id}>
            <path
              d={d}
              fill={cfg.fill}
              stroke={cfg.stroke}
              strokeWidth={cfg.strokeW * 0.3}
              strokeLinejoin="round"
              style={{ cursor: editMode ? 'default' : 'pointer' }}
              onContextMenu={e => {
                if (!editMode) return
                e.preventDefault()
                if (window.confirm(`„${cfg.label}" entfernen?`)) onDelete(area.id)
              }}
            />
            {area.label && (
              <text
                x={pts.reduce((s, p) => s + p.x, 0) / pts.length}
                y={pts.reduce((s, p) => s + p.y, 0) / pts.length}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="2.5"
                fill={cfg.stroke}
                fontWeight="600"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {area.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function CampMap({
  sites, campground, bookings = [],
  onStatusChange, onEdit, onDelete, onPositionSave, onBgSave, userId,
}) {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Modus
  const [editMode, setEditMode]   = useState(false)
  const [mode, setMode]           = useState('sites') // 'sites'|'symbols'|'draw'
  const [selectedSymbol, setSelectedSymbol] = useState(null)
  const [selectedAreaType, setSelectedAreaType] = useState('grass')

  // Flächen zeichnen
  const [drawing, setDrawing]     = useState(false)
  const [currentPoly, setCurrentPoly] = useState([])  // [{x,y}] in %
  const [mousePos, setMousePos]   = useState(null)     // live cursor in %
  const [areaLabel, setAreaLabel] = useState('')

  // Daten
  const [mapSymbols, setMapSymbols] = useState([])
  const [mapAreas, setMapAreas]     = useState([])
  const [unplaced, setUnplaced]     = useState([])

  // Drag
  const [popup, setPopup]   = useState(null)
  const [dragging, setDragging] = useState(null)
  const [localPos, setLocalPos] = useState({})

  // UI
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Gebuchte Site-IDs
  const bookedSiteIds = new Set(
    bookings
      .filter(b => !['cancelled', 'departed'].includes(b.status))
      .map(b => b.site_id)
      .filter(Boolean)
  )

  useEffect(() => {
    setUnplaced(sites.filter(s => s.x_pos == null || s.y_pos == null))
  }, [sites])

  // Größe beobachten (für SVG-Koordinaten)
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const loadSymbols = useCallback(async () => {
    if (!campground) return
    const { data } = await supabase.from('map_symbols').select('*').eq('campground_id', campground.id)
    setMapSymbols(data || [])
  }, [campground])

  const loadAreas = useCallback(async () => {
    if (!campground) return
    const { data } = await supabase.from('map_areas').select('*').eq('campground_id', campground.id)
    setMapAreas(data || [])
  }, [campground])

  useEffect(() => { loadSymbols(); loadAreas() }, [loadSymbols, loadAreas])

  const getPos = useCallback(
    (site) => localPos[site.id] ?? { x: site.x_pos, y: site.y_pos },
    [localPos]
  )

  // Timestamp des letzten Klicks, um dblclick-Doppelpunkt zu verhindern
  const lastClickTime = useRef(0)
  const clientToPercent = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)  / rect.height) * 100)),
    }
  }

  // ── Bild hochladen ─────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !campground) return
    setUploading(true)
    try {
      if (campground.map_bg_url) {
        const oldPath = campground.map_bg_url.split('/campground-maps/')[1]?.split('?')[0]
        if (oldPath) await supabase.storage.from('campground-maps').remove([oldPath])
      }
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${userId}/${campground.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('campground-maps').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { alert('Upload fehlgeschlagen: ' + upErr.message); return }
      const { data } = supabase.storage.from('campground-maps').getPublicUrl(path)
      await onBgSave(data.publicUrl + '?t=' + Date.now())
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeBg = async () => {
    if (!confirm('Hintergrundbild wirklich entfernen?')) return
    if (campground.map_bg_url) {
      const oldPath = campground.map_bg_url.split('/campground-maps/')[1]?.split('?')[0]
      if (oldPath) await supabase.storage.from('campground-maps').remove([oldPath])
    }
    await onBgSave(null)
  }

  // ── Drag & Drop Stellplätze ────────────────────────────────────────────────
  const onMarkerMouseDown = useCallback((e, site) => {
    if (!editMode || mode !== 'sites') return
    e.preventDefault(); e.stopPropagation()
    setPopup(null)
    const rect = containerRef.current.getBoundingClientRect()
    setDragging({
      id: site.id,
      startX: e.clientX, startY: e.clientY,
      origX: site.x_pos ?? 50, origY: site.y_pos ?? 50,
      rectW: rect.width, rectH: rect.height,
    })
  }, [editMode, mode])

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = ((e.clientX - dragging.startX) / dragging.rectW) * 100
      const dy = ((e.clientY - dragging.startY) / dragging.rectH) * 100
      setLocalPos(p => ({ ...p, [dragging.id]: {
        x: Math.max(2, Math.min(98, dragging.origX + dx)),
        y: Math.max(2, Math.min(98, dragging.origY + dy)),
      }}))
    }
    // Live-Cursor für Polygon-Vorschau
    if (drawing && containerRef.current) {
      setMousePos(clientToPercent(e.clientX, e.clientY))
    }
  }, [dragging, drawing])

  const onMouseUp = useCallback(async () => {
    if (!dragging) return
    const pos = localPos[dragging.id]
    if (pos) { setSaving(true); await onPositionSave(dragging.id, pos.x, pos.y); setSaving(false) }
    setDragging(null)
  }, [dragging, localPos, onPositionSave])

  // ── Klick auf Karte ────────────────────────────────────────────────────────
  const onMapClick = useCallback(async (e) => {
    if (!editMode) { setPopup(null); return }
    if (dragging) return
    // Doppelklick-Schutz: onClick feuert auch bei dblclick — ignorieren
    // wenn der letzte Klick weniger als 300ms her ist (= dblclick)
    const now = Date.now()
    if (now - lastClickTime.current < 300) return
    lastClickTime.current = now

    const p = clientToPercent(e.clientX, e.clientY)

    if (mode === 'symbols' && selectedSymbol) {
      setSaving(true)
      await supabase.from('map_symbols').insert({
        campground_id: campground.id,
        symbol_type: selectedSymbol,
        x_pos: p.x, y_pos: p.y,
        label: SYMBOL_MAP[selectedSymbol]?.label || '',
      })
      await loadSymbols()
      setSaving(false)

    } else if (mode === 'draw') {
      if (drawing) {
        setCurrentPoly(pts => [...pts, p])
      } else {
        setDrawing(true)
        setCurrentPoly([p])
      }

    } else if (mode === 'sites' && unplaced.length > 0) {
      onPositionSave(unplaced[0].id, p.x, p.y)
    }
  }, [editMode, dragging, mode, selectedSymbol, drawing, unplaced, campground, loadSymbols, onPositionSave])

  // Doppelklick → Polygon schließen & speichern
  const onMapDblClick = useCallback(async (e) => {
    e.preventDefault()
    lastClickTime.current = Date.now() // markiere, damit der onClick-Nachläufer ignoriert wird
    if (!drawing || currentPoly.length < 3) {
      setDrawing(false); setCurrentPoly([]); return
    }
    setSaving(true)
    await supabase.from('map_areas').insert({
      campground_id: campground.id,
      area_type: selectedAreaType,
      label: areaLabel.trim() || null,
      points: currentPoly,
    })
    await loadAreas()
    setDrawing(false); setCurrentPoly([]); setAreaLabel(''); setSaving(false)
  }, [drawing, currentPoly, campground, selectedAreaType, areaLabel, loadAreas])

  // Escape → Zeichnen abbrechen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && drawing) { setDrawing(false); setCurrentPoly([]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawing])

  // Klick auf Marker
  const onMarkerClick = useCallback((e, site) => {
    e.stopPropagation()
    if (dragging || mode !== 'sites') return
    setPopup(p => p?.site?.id === site.id ? null : { site, x: getPos(site).x, y: getPos(site).y })
  }, [dragging, mode, getPos])

  // Von Karte entfernen
  const removeFromMap = useCallback(async (site) => {
    setPopup(null); setSaving(true)
    await supabase.from('sites').update({ x_pos: null, y_pos: null }).eq('id', site.id)
    await onPositionSave(site.id, null, null)
    setSaving(false)
  }, [onPositionSave])

  // Symbol löschen
  const deleteSymbol = useCallback(async (id) => {
    await supabase.from('map_symbols').delete().eq('id', id)
    await loadSymbols()
  }, [loadSymbols])

  // Fläche löschen
  const deleteArea = useCallback(async (id) => {
    await supabase.from('map_areas').delete().eq('id', id)
    await loadAreas()
  }, [loadAreas])

  // Stellplatz löschen (mit Schutz)
  const handleDelete = useCallback((site) => {
    setPopup(null)
    onDelete(site.id)
  }, [onDelete])

  // ── Render ─────────────────────────────────────────────────────────────────
  const bgUrl  = campground?.map_bg_url
  const placed = sites.filter(s => s.x_pos != null && s.y_pos != null)

  // Polygon-Vorschau-Punkte als SVG-Pfad
  const previewPoints = mousePos
    ? [...currentPoly, mousePos]
    : currentPoly

  const polyToSvg = (pts) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const modeLabel = {
    sites:   mode === 'sites' && editMode
      ? unplaced.length > 0
        ? `📍 Klick = „${unplaced[0].name}" platzieren · Marker ziehen = verschieben`
        : '✓ Alle Stellplätze platziert · Klicken = Menü'
      : null,
    symbols: mode === 'symbols' && editMode
      ? selectedSymbol
        ? `${SYMBOL_MAP[selectedSymbol]?.emoji} Klick = platzieren · Rechtsklick auf Symbol = löschen`
        : '← Symbol auswählen'
      : null,
    draw: mode === 'draw' && editMode
      ? drawing
        ? `Klicke Punkte · Doppelklick = Fläche abschließen · Esc = Abbrechen (${currentPoly.length} Punkte)`
        : '← Flächentyp wählen · Klicke auf Karte um zu beginnen'
      : null,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 18px', borderBottom: '1px solid var(--border)',
        background: editMode ? '#FEF3C7' : 'var(--card)',
        transition: 'background 0.2s', flexWrap: 'wrap', gap: 8,
      }}>
        {/* Legende */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg }} />
              <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
            </div>
          ))}
          {(saving || uploading) && (
            <span style={{ color: 'var(--green-700)', fontWeight: 500 }}>
              {uploading ? '⬆️ Hochladen…' : '💾 Speichern…'}
            </span>
          )}
        </div>

        {/* Buttons rechts */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            🖼️ {bgUrl ? 'Bild ersetzen' : 'Bild hochladen'}
          </button>
          {bgUrl && (
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={removeBg}>✕ Entfernen</button>
          )}
          <button
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setEditMode(v => !v)
              setPopup(null); setDrawing(false); setCurrentPoly([])
              setSelectedSymbol(null); setMode('sites')
            }}
          >
            {editMode ? <><Icon name="check" size={13} /> Fertig</> : <><Icon name="edit" size={13} /> Bearbeiten</>}
          </button>
        </div>
      </div>

      {/* ── Bearbeitungs-Palette ── */}
      {editMode && (
        <div style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC', padding: '10px 18px' }}>
          {/* Modus-Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[
              ['sites',   '📍 Stellplätze'],
              ['symbols', '🎨 Symbole'],
              ['draw',    '✏️ Flächen zeichnen'],
            ].map(([m, lbl]) => (
              <button key={m}
                onClick={() => { setMode(m); setSelectedSymbol(null); setDrawing(false); setCurrentPoly([]) }}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${mode === m ? '#1B4332' : 'var(--border)'}`,
                  background: mode === m ? '#1B4332' : '#fff',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                }}
              >{lbl}</button>
            ))}
          </div>

          {/* Symbole */}
          {mode === 'symbols' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SYMBOLS.map(s => (
                <button key={s.type} onClick={() => setSelectedSymbol(t => t === s.type ? null : s.type)}
                  title={s.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 8, cursor: 'pointer', minWidth: 52,
                    border: `2px solid ${selectedSymbol === s.type ? '#1D4ED8' : 'var(--border)'}`,
                    background: selectedSymbol === s.type ? '#EFF6FF' : '#fff',
                    fontSize: 20,
                  }}>
                  {s.emoji}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center', lineHeight: 1.1 }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Flächen zeichnen */}
          {mode === 'draw' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: drawing ? 10 : 0 }}>
                {AREA_TYPES.map(a => (
                  <button key={a.type}
                    onClick={() => { if (!drawing) setSelectedAreaType(a.type) }}
                    disabled={drawing}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 14px', borderRadius: 8, cursor: drawing ? 'default' : 'pointer',
                      border: `2px solid ${selectedAreaType === a.type ? a.stroke : 'var(--border)'}`,
                      background: selectedAreaType === a.type ? a.fill : '#fff',
                      fontSize: 13, fontWeight: selectedAreaType === a.type ? 700 : 400,
                      opacity: drawing && selectedAreaType !== a.type ? 0.5 : 1,
                    }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: a.fill, border: `2px solid ${a.stroke}`,
                    }} />
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Beschriftung + Abbrechen während Zeichnen */}
              {drawing && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, maxWidth: 240, fontSize: 12, padding: '5px 10px' }}
                    placeholder="Optionale Beschriftung (z.B. „Hauptwiese")"
                    value={areaLabel}
                    onChange={e => setAreaLabel(e.target.value)}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setDrawing(false); setCurrentPoly([]) }}
                  >
                    Abbrechen
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {currentPoly.length} Punkte gesetzt · Doppelklick zum Abschließen
                  </span>
                </div>
              )}

              {!drawing && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Flächentyp wählen → auf die Karte klicken → Punkte setzen → Doppelklick zum Abschließen.
                  Rechtsklick auf eine Fläche entfernt sie.
                </div>
              )}
            </div>
          )}

          {/* Hinweis-Banner */}
          {modeLabel[mode] && (
            <div style={{
              marginTop: 8, padding: '5px 12px', borderRadius: 6,
              background: 'rgba(27,67,50,0.08)', fontSize: 12, color: '#1B4332', fontWeight: 500,
            }}>
              {modeLabel[mode]}
            </div>
          )}
        </div>
      )}

      {/* ── Karte + Seitenpanel ── */}
      <div style={{ display: 'flex', minHeight: 520 }}>

        {/* Hauptfläche */}
        <div
          ref={containerRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { onMouseUp(); setMousePos(null) }}
          onClick={onMapClick}
          onDoubleClick={onMapDblClick}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden', minHeight: 520,
            cursor: editMode
              ? dragging ? 'grabbing'
              : mode === 'draw' ? (drawing ? 'crosshair' : 'cell')
              : mode === 'sites' && unplaced.length > 0 ? 'crosshair'
              : 'grab'
              : 'default',
            background: bgUrl
              ? `url(${bgUrl}) center/cover no-repeat`
              : `linear-gradient(rgba(212,208,200,0.25) 1px,transparent 1px),
                 linear-gradient(90deg,rgba(212,208,200,0.25) 1px,transparent 1px),#F4F1EB`,
            backgroundSize: bgUrl ? 'cover' : '40px 40px,40px 40px,auto',
            userSelect: 'none',
          }}
        >
          {/* Gezeichnete Flächen (SVG, hinter allem) */}
          <MapAreas
            areas={mapAreas}
            width={containerSize.w}
            height={containerSize.h}
            editMode={editMode && mode === 'draw'}
            onDelete={deleteArea}
          />

          {/* Polygon-Vorschau während Zeichnen */}
          {drawing && previewPoints.length >= 1 && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Geschlossene Vorschau-Fläche */}
              {previewPoints.length >= 3 && (
                <path
                  d={polyToSvg(previewPoints) + ' Z'}
                  fill={AREA_MAP[selectedAreaType]?.fill || 'rgba(134,239,172,0.3)'}
                  stroke={AREA_MAP[selectedAreaType]?.stroke || 'rgba(34,197,94,0.7)'}
                  strokeWidth="0.4"
                  strokeDasharray="1,0.5"
                />
              )}
              {/* Linie */}
              <polyline
                points={previewPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={AREA_MAP[selectedAreaType]?.stroke || 'rgba(34,197,94,0.7)'}
                strokeWidth="0.5"
                strokeDasharray="1,0.5"
              />
              {/* Punkte */}
              {currentPoly.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="0.8"
                  fill={i === 0 ? '#fff' : AREA_MAP[selectedAreaType]?.stroke}
                  stroke={AREA_MAP[selectedAreaType]?.stroke}
                  strokeWidth="0.3"
                />
              ))}
            </svg>
          )}

          {/* Leer-Zustand */}
          {placed.length === 0 && mapAreas.length === 0 && !editMode && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', textAlign: 'center', padding: 40, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Platzplan vorhanden</div>
              <div style={{ fontSize: 13 }}>
                Klicke auf „Bearbeiten" um Flächen zu zeichnen,<br />
                Symbole zu platzieren und Stellplätze einzutragen.
              </div>
            </div>
          )}

          {/* Stellplatz-Marker */}
          {placed.map(site => {
            const pos        = getPos(site)
            const cfg        = STATUS_COLOR[site.status]
            const isDragging = dragging?.id === site.id
            const isOpen     = popup?.site?.id === site.id
            const hasBooking = bookedSiteIds.has(site.id)

            return (
              <div key={site.id}
                onMouseDown={e => onMarkerMouseDown(e, site)}
                onClick={e => onMarkerClick(e, site)}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: 'translate(-50%,-50%)',
                  zIndex: isDragging ? 40 : isOpen ? 30 : 15,
                  cursor: editMode && mode === 'sites' ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: cfg.bg,
                  border: `3px solid ${isOpen ? '#fff' : cfg.border}`,
                  boxShadow: isOpen
                    ? `0 0 0 3px ${cfg.bg},0 4px 16px rgba(0,0,0,0.3)`
                    : isDragging ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: isDragging ? 'scale(1.12)' : 'scale(1)',
                  transition: isDragging ? 'none' : 'all 0.12s',
                  position: 'relative',
                }}>
                  <span style={{
                    color: '#fff', fontWeight: 700, fontFamily: "'Sora',sans-serif",
                    fontSize: site.name.length > 4 ? 8 : site.name.length > 3 ? 9 : 11,
                    lineHeight: 1.1, textAlign: 'center', padding: '0 2px', wordBreak: 'break-all',
                  }}>{site.name}</span>
                  {/* Buchungs-Indikator */}
                  {hasBooking && (
                    <div style={{
                      position: 'absolute', top: -5, right: -5,
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#EF4444', border: '2px solid #fff',
                    }} title="Hat aktive Buchung" />
                  )}
                </div>

                {isOpen && (
                  <SitePopup
                    site={{ ...site, _hasBooking: hasBooking }}
                    pos={pos}
                    onClose={() => setPopup(null)}
                    onStatusChange={(s, status) => { onStatusChange(s, status); setPopup(null) }}
                    onEdit={s => { setPopup(null); onEdit(s) }}
                    onDelete={handleDelete}
                    onRemoveFromMap={removeFromMap}
                  />
                )}
              </div>
            )
          })}

          {/* Symbole */}
          {mapSymbols.map(sym => {
            const def = SYMBOL_MAP[sym.symbol_type] || { emoji: '❓', label: sym.symbol_type }
            return (
              <div key={sym.id}
                onContextMenu={e => {
                  e.preventDefault(); e.stopPropagation()
                  if (editMode && confirm(`„${def.label}" entfernen?`)) deleteSymbol(sym.id)
                }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${sym.x_pos}%`, top: `${sym.y_pos}%`,
                  transform: 'translate(-50%,-50%)',
                  fontSize: 22, lineHeight: 1, userSelect: 'none',
                  cursor: editMode && mode === 'symbols' ? 'context-menu' : 'default',
                  zIndex: 8,
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))',
                }}
                title={editMode && mode === 'symbols' ? `${def.label} — Rechtsklick zum Löschen` : def.label}
              >
                {def.emoji}
              </div>
            )
          })}

          {/* Hinweis-Pill unten */}
          {editMode && modeLabel[mode] && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(27,67,50,0.88)', color: '#fff',
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              pointerEvents: 'none', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap',
            }}>{modeLabel[mode]}</div>
          )}
        </div>

        {/* ── Seitenpanel: nicht platziert ── */}
        {(editMode && mode === 'sites') || (!editMode && unplaced.length > 0) ? (
          <div style={{ width: 196, borderLeft: '1px solid var(--border)', background: 'var(--bg)', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.5px', color: 'var(--text-muted)',
            }}>
              Nicht platziert ({unplaced.length})
            </div>
            {unplaced.length === 0
              ? <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>✅ Alle platziert</div>
              : unplaced.map((s, i) => {
                  const cfg = STATUS_COLOR[s.status]
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 14px', borderBottom: '1px solid var(--border)',
                      background: editMode && i === 0 && mode === 'sites' ? '#FEF3C7' : 'transparent',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 5, background: cfg.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>{s.name}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type}</div>
                      </div>
                      {editMode && i === 0 && mode === 'sites' && (
                        <span style={{ fontSize: 10, color: '#92400E', flexShrink: 0 }}>← Nächster</span>
                      )}
                    </div>
                  )
                })
            }
          </div>
        ) : null}
      </div>
    </div>
  )
}
