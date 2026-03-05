import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './ui'

const STATUS_COLOR = {
  free:     { bg: '#2D6A4F', border: '#1B4332', text: '#fff', label: 'Frei' },
  occupied: { bg: '#D97706', border: '#92400E', text: '#fff', label: 'Belegt' },
  blocked:  { bg: '#9CA3AF', border: '#6B7280', text: '#fff', label: 'Gesperrt' },
}

// ─── Kartensymbole ────────────────────────────────────────────────────────────
const SYMBOLS = [
  { type: 'tree',        emoji: '🌲', label: 'Baum' },
  { type: 'shower',      emoji: '🚿', label: 'Dusche' },
  { type: 'toilet',      emoji: '🚽', label: 'Toilette' },
  { type: 'parking',     emoji: '🅿️', label: 'Parkplatz' },
  { type: 'reception',   emoji: '🏠', label: 'Rezeption' },
  { type: 'shop',        emoji: '🏪', label: 'Kiosk/Shop' },
  { type: 'power',       emoji: '⚡', label: 'Stromanschluss' },
  { type: 'water',       emoji: '💧', label: 'Wasseranschluss' },
  { type: 'fire',        emoji: '🔥', label: 'Feuerstelle' },
  { type: 'playground',  emoji: '🛝', label: 'Spielplatz' },
  { type: 'trash',       emoji: '🗑️', label: 'Müll' },
  { type: 'road',        emoji: '🛤️', label: 'Zufahrt' },
  { type: 'tent_area',   emoji: '⛺', label: 'Zeltbereich' },
  { type: 'pool',        emoji: '🏊', label: 'Pool/See' },
  { type: 'dog',         emoji: '🐕', label: 'Hundewiese' },
  { type: 'wash',        emoji: '🧺', label: 'Waschmaschine' },
]
const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.type, s]))

// ─── Marker-Popup ─────────────────────────────────────────────────────────────
function SitePopup({ site, pos, editMode, onClose, onStatusChange, onEdit, onDelete, onRemoveFromMap }) {
  // Popup rechts oder links vom Marker, je nach Position
  const goLeft = pos.x > 65
  return (
    <div
      style={{
        position: 'absolute',
        [goLeft ? 'right' : 'left']: goLeft ? 'calc(100% + 8px)' : 'calc(100% + 8px)',
        top: '-10px',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        padding: '14px 16px',
        minWidth: 210,
        zIndex: 100,
        fontSize: 13,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15 }}>{site.name}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 1, fontSize: 14 }}>✕</button>
      </div>

      <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        {site.type}{site.size ? ` · ${site.size}` : ''}
        {site.electric ? ' · ⚡' : ''}{site.water ? ' · 💧' : ''}
      </div>

      {/* Status-Buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <button key={s} onClick={() => onStatusChange(site, s)} style={{
            flex: 1, padding: '5px 2px', borderRadius: 6,
            border: `2px solid ${site.status === s ? c.border : 'transparent'}`,
            background: site.status === s ? c.bg : '#F3F4F6',
            color: site.status === s ? '#fff' : '#6B7280',
            fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}>{c.label}</button>
        ))}
      </div>

      {/* Aktionsbuttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button onClick={() => onEdit(site)} style={{
          width: '100%', padding: '7px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg)',
          fontSize: 12, cursor: 'pointer', color: 'var(--text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <Icon name="edit" size={12} /> Bearbeiten
        </button>
        <button onClick={() => onRemoveFromMap(site)} style={{
          width: '100%', padding: '7px', borderRadius: 6,
          border: '1px solid #FCD34D', background: '#FFFBEB',
          fontSize: 12, cursor: 'pointer', color: '#92400E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          📍 Von Karte entfernen
        </button>
        <button onClick={() => onDelete(site)} style={{
          width: '100%', padding: '7px', borderRadius: 6,
          border: '1px solid #FECACA', background: '#FEF2F2',
          fontSize: 12, cursor: 'pointer', color: '#991B1B',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <Icon name="trash" size={12} /> Stellplatz löschen
        </button>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function CampMap({ sites, campground, onStatusChange, onEdit, onDelete, onPositionSave, onBgSave, userId }) {
  const containerRef  = useRef(null)
  const fileInputRef  = useRef(null)
  const [editMode, setEditMode]       = useState(false)
  const [mode, setMode]               = useState('sites')   // 'sites' | 'symbols'
  const [selectedSymbol, setSelectedSymbol] = useState(null) // type string
  const [mapSymbols, setMapSymbols]   = useState([])
  const [popup, setPopup]             = useState(null)
  const [dragging, setDragging]       = useState(null)
  const [localPos, setLocalPos]       = useState({})
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [unplaced, setUnplaced]       = useState([])

  useEffect(() => {
    setUnplaced(sites.filter(s => s.x_pos == null || s.y_pos == null))
  }, [sites])

  // Symbole laden
  useEffect(() => {
    if (!campground) return
    supabase.from('map_symbols')
      .select('*')
      .eq('campground_id', campground.id)
      .then(({ data }) => setMapSymbols(data || []))
  }, [campground])

  const loadSymbols = useCallback(async () => {
    if (!campground) return
    const { data } = await supabase.from('map_symbols').select('*').eq('campground_id', campground.id)
    setMapSymbols(data || [])
  }, [campground])

  const getPos = (site) => localPos[site.id] ?? { x: site.x_pos, y: site.y_pos }

  // ── Bild direkt hochladen ──────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !campground) return

    setUploading(true)
    try {
      // Altes Bild löschen falls vorhanden
      if (campground.map_bg_url) {
        const oldPath = campground.map_bg_url.split('/campground-maps/')[1]
        if (oldPath) await supabase.storage.from('campground-maps').remove([oldPath])
      }

      // Neues Bild hochladen: {userId}/{campground_id}.{ext}
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${userId}/${campground.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('campground-maps')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) { alert('Upload fehlgeschlagen: ' + upErr.message); return }

      // Öffentliche URL holen
      const { data } = supabase.storage.from('campground-maps').getPublicUrl(path)
      // Cache-Buster damit der Browser das neue Bild lädt
      const url = data.publicUrl + '?t=' + Date.now()
      await onBgSave(url)
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

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const onMarkerMouseDown = useCallback((e, site) => {
    if (!editMode) return
    e.preventDefault(); e.stopPropagation()
    setPopup(null)
    const rect = containerRef.current.getBoundingClientRect()
    setDragging({ id: site.id, startX: e.clientX, startY: e.clientY,
      origX: site.x_pos ?? 50, origY: site.y_pos ?? 50,
      rectW: rect.width, rectH: rect.height })
  }, [editMode])

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const dx = ((e.clientX - dragging.startX) / dragging.rectW) * 100
    const dy = ((e.clientY - dragging.startY) / dragging.rectH) * 100
    const newX = Math.max(2, Math.min(98, dragging.origX + dx))
    const newY = Math.max(2, Math.min(98, dragging.origY + dy))
    setLocalPos(p => ({ ...p, [dragging.id]: { x: newX, y: newY } }))
  }, [dragging])

  const onMouseUp = useCallback(async () => {
    if (!dragging) return
    const pos = localPos[dragging.id]
    if (pos) { setSaving(true); await onPositionSave(dragging.id, pos.x, pos.y); setSaving(false) }
    setDragging(null)
  }, [dragging, localPos, onPositionSave])

  // Klick auf Karte
  const onMapClick = useCallback(async (e) => {
    if (!editMode) { setPopup(null); return }
    if (dragging) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100

    if (mode === 'symbols' && selectedSymbol) {
      // Symbol an dieser Stelle ablegen
      setSaving(true)
      await supabase.from('map_symbols').insert({
        campground_id: campground.id,
        symbol_type: selectedSymbol,
        x_pos: x, y_pos: y,
        label: SYMBOL_MAP[selectedSymbol]?.label || '',
      })
      await loadSymbols()
      setSaving(false)
    } else if (mode === 'sites' && unplaced.length > 0) {
      onPositionSave(unplaced[0].id, x, y)
    }
  }, [editMode, dragging, mode, selectedSymbol, unplaced, campground, loadSymbols, onPositionSave])

  // Klick auf Marker → Popup
  const onMarkerClick = useCallback((e, site) => {
    e.stopPropagation()
    if (dragging) return
    const pos = getPos(site)
    setPopup(p => p?.site?.id === site.id ? null : { site, x: pos.x, y: pos.y })
  }, [dragging, getPos])

  // Marker von Karte entfernen (Position löschen, Stellplatz bleibt)
  const removeFromMap = useCallback(async (site) => {
    setPopup(null)
    setSaving(true)
    await supabase.from('sites').update({ x_pos: null, y_pos: null }).eq('id', site.id)
    await onPositionSave(site.id, null, null)
    setSaving(false)
  }, [onPositionSave])

  // Stellplatz komplett löschen
  const handleDelete = useCallback((site) => {
    setPopup(null)
    onDelete(site.id)
  }, [onDelete])

  // Symbol löschen
  const deleteSymbol = useCallback(async (id) => {
    await supabase.from('map_symbols').delete().eq('id', id)
    await loadSymbols()
  }, [loadSymbols])

  const bgUrl  = campground?.map_bg_url
  const placed = sites.filter(s => s.x_pos != null && s.y_pos != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: '1px solid var(--border)',
        background: editMode ? '#FEF3C7' : 'var(--card)', transition: 'background 0.2s',
        flexWrap: 'wrap', gap: 10,
      }}>
        {/* Legende */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: c.bg }} />
              <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
            </div>
          ))}
          {(saving || uploading) && (
            <span style={{ fontSize: 12, color: 'var(--green-700)', fontWeight: 500 }}>
              {uploading ? '⬆️ Bild wird hochgeladen…' : 'Speichern…'}
            </span>
          )}
          {editMode && mode === 'sites' && unplaced.length > 0 && (
            <span style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
              📍 Klicke auf die Karte → „{unplaced[0].name}" platzieren
            </span>
          )}
          {editMode && mode === 'symbols' && selectedSymbol && (
            <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 500 }}>
              {SYMBOL_MAP[selectedSymbol]?.emoji} Klicke auf die Karte um „{SYMBOL_MAP[selectedSymbol]?.label}" zu platzieren
            </span>
          )}
        </div>

        {/* Rechte Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            🖼️ {bgUrl ? 'Bild ersetzen' : 'Bild hochladen'}
          </button>
          {bgUrl && (
            <button className="btn btn-secondary btn-sm" onClick={removeBg} style={{ color: 'var(--red)' }}>
              ✕ Entfernen
            </button>
          )}
          <button
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setEditMode(e => !e); setPopup(null); setSelectedSymbol(null) }}
          >
            {editMode ? <><Icon name="check" size={13} /> Fertig</> : <><Icon name="edit" size={13} /> Bearbeiten</>}
          </button>
        </div>
      </div>

      {/* ── Symbol-Palette (nur im Bearbeitungsmodus) ── */}
      {editMode && (
        <div style={{
          borderBottom: '1px solid var(--border)',
          background: '#F8FAFC', padding: '10px 18px',
        }}>
          {/* Modus-Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['sites', '📍 Stellplätze platzieren'], ['symbols', '🎨 Symbole & Icons zeichnen']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setSelectedSymbol(null) }}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${mode === m ? '#1B4332' : 'var(--border)'}`,
                  background: mode === m ? '#1B4332' : '#fff',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Symbol-Auswahl */}
          {mode === 'symbols' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Symbol auswählen → auf Karte klicken zum Platzieren:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SYMBOLS.map(s => (
                  <button key={s.type} onClick={() => setSelectedSymbol(t => t === s.type ? null : s.type)}
                    title={s.label}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${selectedSymbol === s.type ? '#1D4ED8' : 'var(--border)'}`,
                      background: selectedSymbol === s.type ? '#EFF6FF' : '#fff',
                      fontSize: 20, lineHeight: 1.2, minWidth: 52,
                    }}>
                    {s.emoji}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center', lineHeight: 1.1 }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Kartenbereich ── */}
      <div style={{ display: 'flex', minHeight: 520 }}>

        {/* Hauptfläche */}
        <div
          ref={containerRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={onMapClick}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden', minHeight: 520,
            cursor: editMode
              ? (dragging ? 'grabbing' : unplaced.length > 0 ? 'crosshair' : 'grab')
              : 'default',
            background: bgUrl
              ? `url(${bgUrl}) center/cover no-repeat`
              : `linear-gradient(rgba(212,208,200,0.25) 1px,transparent 1px),
                 linear-gradient(90deg,rgba(212,208,200,0.25) 1px,transparent 1px),
                 #F4F1EB`,
            backgroundSize: bgUrl ? 'cover' : '40px 40px,40px 40px,auto',
          }}
        >
          {/* Leer-Zustand */}
          {placed.length === 0 && !editMode && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', textAlign: 'center', padding: 40, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Platzplan vorhanden</div>
              <div style={{ fontSize: 13 }}>
                Lade ein Bild hoch und klicke auf „Platzplan bearbeiten",<br />
                um Stellplätze auf der Karte zu platzieren.
              </div>
            </div>
          )}

          {/* Marker */}
          {placed.map(site => {
            const pos  = getPos(site)
            const cfg  = STATUS_COLOR[site.status]
            const isDragging = dragging?.id === site.id
            const isOpen     = popup?.site?.id === site.id

            return (
              <div
                key={site.id}
                onMouseDown={e => onMarkerMouseDown(e, site)}
                onClick={e => onMarkerClick(e, site)}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: 'translate(-50%,-50%)',
                  zIndex: isDragging ? 40 : isOpen ? 30 : 10,
                  cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                  userSelect: 'none',
                }}
              >
                {/* Marker-Box */}
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
                }}>
                  <span style={{
                    color: '#fff', fontWeight: 700, fontFamily: "'Sora',sans-serif",
                    fontSize: site.name.length > 4 ? 8 : site.name.length > 3 ? 9 : 11,
                    lineHeight: 1.1, textAlign: 'center', padding: '0 2px', wordBreak: 'break-all',
                  }}>
                    {site.name}
                  </span>
                </div>

                {/* Popup */}
                {isOpen && (
                  <SitePopup
                    site={site}
                    pos={pos}
                    editMode={editMode}
                    onClose={() => setPopup(null)}
                    onStatusChange={(s, status) => { onStatusChange(s, status); setPopup(null) }}
                    onEdit={(s) => { setPopup(null); onEdit(s) }}
                    onDelete={handleDelete}
                    onRemoveFromMap={removeFromMap}
                  />
                )}
              </div>
            )
          })}

          {/* Editier-Hinweis */}
          {editMode && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(27,67,50,0.88)', color: '#fff',
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              pointerEvents: 'none', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap',
            }}>
              {mode === 'symbols'
                ? selectedSymbol
                  ? `${SYMBOL_MAP[selectedSymbol]?.emoji} Klicke auf die Karte zum Platzieren · Rechtsklick auf Symbol = Löschen`
                  : '← Symbol in der Palette auswählen'
                : unplaced.length > 0
                  ? `📍 Klick = „${unplaced[0].name}" platzieren · Marker ziehen = verschieben`
                  : '✓ Alle Stellplätze platziert · Marker ziehen zum Verschieben · Klicken = Bearbeiten'}
            </div>
          )}

          {/* Kartensymbole */}
          {mapSymbols.map(sym => {
            const def = SYMBOL_MAP[sym.symbol_type] || { emoji: '❓', label: sym.symbol_type }
            return (
              <div
                key={sym.id}
                onContextMenu={e => {
                  e.preventDefault(); e.stopPropagation()
                  if (editMode && confirm(`„${def.label}" entfernen?`)) deleteSymbol(sym.id)
                }}
                onClick={e => { e.stopPropagation() }}
                style={{
                  position: 'absolute',
                  left: `${sym.x_pos}%`, top: `${sym.y_pos}%`,
                  transform: 'translate(-50%,-50%)',
                  fontSize: 24, lineHeight: 1,
                  userSelect: 'none',
                  cursor: editMode ? 'context-menu' : 'default',
                  zIndex: 5,
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
                  title: def.label,
                }}
                title={editMode ? `${def.label} — Rechtsklick zum Löschen` : def.label}
              >
                {def.emoji}
              </div>
            )
          })}
        </div>

        {/* ── Seitenpanel: nicht platziert ── */}
        {(editMode || unplaced.length > 0) && (
          <div style={{
            width: 196, borderLeft: '1px solid var(--border)',
            background: 'var(--bg)', overflowY: 'auto', flexShrink: 0,
          }}>
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
                      background: editMode && i === 0 ? '#FEF3C7' : 'transparent',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 5, background: cfg.bg, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#fff',
                      }}>{s.name}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type}</div>
                      </div>
                      {editMode && i === 0 && <span style={{ fontSize: 10, color: '#92400E', flexShrink: 0 }}>← Nächster</span>}
                    </div>
                  )
                })
            }
            {editMode && unplaced.length > 0 && (
              <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                Klicke auf die Karte um den markierten Stellplatz zu platzieren.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
