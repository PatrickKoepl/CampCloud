import { useState, useRef, useCallback, useEffect } from 'react'
import { Icon } from './ui'

// ─── Farben nach Status ───────────────────────────────────────────────────────
const STATUS_COLOR = {
  free:     { bg: '#2D6A4F', border: '#1B4332', text: '#fff', label: 'Frei' },
  occupied: { bg: '#D97706', border: '#92400E', text: '#fff', label: 'Belegt' },
  blocked:  { bg: '#9CA3AF', border: '#6B7280', text: '#fff', label: 'Gesperrt' },
}

// ─── Kleines Popup das beim Anklicken eines Markers erscheint ─────────────────
function SitePopup({ site, pos, onClose, onStatusChange, onEdit }) {
  const cfg = STATUS_COLOR[site.status]
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(${pos.x}% + 22px)`,
        top:  `calc(${pos.y}% - 20px)`,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '14px 16px',
        minWidth: 200,
        zIndex: 50,
        fontSize: 13,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Pfeil links */}
      <div style={{
        position: 'absolute', left: -7, top: 24,
        width: 12, height: 12,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRight: 'none', borderBottom: 'none',
        transform: 'rotate(-45deg)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15 }}>{site.name}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 1 }}
        >✕</button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {site.type}{site.size ? ` · ${site.size}` : ''}
        {site.electric ? ' · ⚡' : ''}
        {site.water    ? ' · 💧' : ''}
      </div>

      {/* Status Buttons */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <button
            key={s}
            onClick={() => onStatusChange(site, s)}
            style={{
              flex: 1,
              padding: '5px 4px',
              borderRadius: 6,
              border: `2px solid ${site.status === s ? c.border : 'transparent'}`,
              background: site.status === s ? c.bg : '#F3F4F6',
              color: site.status === s ? '#fff' : '#6B7280',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onEdit(site)}
        style={{
          width: '100%', padding: '6px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg)',
          fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}
      >
        <Icon name="edit" size={12} /> Details bearbeiten
      </button>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function CampMap({ sites, campground, onStatusChange, onEdit, onPositionSave, onBgSave }) {
  const containerRef = useRef(null)
  const [editMode, setEditMode]       = useState(false)
  const [popup, setPopup]             = useState(null)   // { site, x, y }
  const [dragging, setDragging]       = useState(null)   // { id, startX, startY, origX, origY }
  const [localPos, setLocalPos]       = useState({})     // { [id]: {x, y} } — Drag-Preview
  const [bgInput, setBgInput]         = useState(campground?.map_bg_url || '')
  const [showBgEdit, setShowBgEdit]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [unplaced, setUnplaced]       = useState([])

  // Nicht platzierte Stellplätze
  useEffect(() => {
    setUnplaced(sites.filter(s => s.x_pos == null || s.y_pos == null))
  }, [sites])

  // Aktuelle Position eines Stellplatzes (Drag-Preview oder DB-Wert)
  const getPos = (site) => localPos[site.id] ?? { x: site.x_pos, y: site.y_pos }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onMarkerMouseDown = useCallback((e, site) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()
    setPopup(null)
    const rect = containerRef.current.getBoundingClientRect()
    setDragging({
      id:     site.id,
      startX: e.clientX,
      startY: e.clientY,
      origX:  site.x_pos ?? 50,
      origY:  site.y_pos ?? 50,
      rectW:  rect.width,
      rectH:  rect.height,
    })
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
    if (pos) {
      setSaving(true)
      await onPositionSave(dragging.id, pos.x, pos.y)
      setSaving(false)
    }
    setDragging(null)
  }, [dragging, localPos, onPositionSave])

  // Klick auf leere Fläche im Edit-Modus → neuen Stellplatz platzieren
  const onMapClick = useCallback((e) => {
    if (!editMode) { setPopup(null); return }
    if (dragging) return
    if (unplaced.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100
    // Nächsten nicht-platzierten Stellplatz hier ablegen
    const next = unplaced[0]
    onPositionSave(next.id, x, y)
  }, [editMode, dragging, unplaced, onPositionSave])

  // Klick auf Marker im View-Modus → Popup
  const onMarkerClick = useCallback((e, site) => {
    e.stopPropagation()
    if (editMode) return
    const pos = getPos(site)
    setPopup(popup?.site?.id === site.id ? null : { site, x: pos.x, y: pos.y })
  }, [editMode, popup, getPos])

  // Hintergrundbild speichern
  const saveBg = async () => {
    setSaving(true)
    await onBgSave(bgInput.trim())
    setSaving(false)
    setShowBgEdit(false)
  }

  const placed = sites.filter(s => s.x_pos != null && s.y_pos != null)
  const bgUrl  = campground?.map_bg_url

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        background: editMode ? '#FEF3C7' : 'var(--card)',
        transition: 'background 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Legende */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <div style={{ width: 11, height: 11, borderRadius: 3, background: c.bg }} />
                <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
              </div>
            ))}
          </div>
          {editMode && unplaced.length > 0 && (
            <span style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
              📍 Klicke auf die Karte um „{unplaced[0].name}" zu platzieren
            </span>
          )}
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Speichern…</span>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBgEdit(s => !s)}
            title="Hintergrundbild ändern"
          >
            🖼️ Hintergrundbild
          </button>
          <button
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setEditMode(e => !e); setPopup(null) }}
          >
            {editMode ? <><Icon name="check" size={13} /> Fertig</> : <><Icon name="edit" size={13} /> Platzplan bearbeiten</>}
          </button>
        </div>
      </div>

      {/* ── Hintergrundbild-Editor ── */}
      {showBgEdit && (
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          background: '#F0FDF4',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--green-900)', whiteSpace: 'nowrap' }}>
            Bild-URL:
          </span>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 200, maxWidth: 480 }}
            value={bgInput}
            onChange={e => setBgInput(e.target.value)}
            placeholder="https://… (Luftbild, eigener Plan als JPG/PNG)"
          />
          <button className="btn btn-primary btn-sm" onClick={saveBg} disabled={saving}>
            <Icon name="check" size={13} /> Übernehmen
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setBgInput(''); onBgSave('') }}>
            Entfernen
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Tipp: Lade ein Bild bei <a href="https://imgur.com" target="_blank" rel="noreferrer" style={{ color: 'var(--green-700)' }}>imgur.com</a> hoch und füge die Bild-URL ein.
          </span>
        </div>
      )}

      {/* ── Karte ── */}
      <div style={{ display: 'flex', minHeight: 520 }}>

        {/* Hauptfläche */}
        <div
          ref={containerRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={onMapClick}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 520,
            cursor: editMode
              ? (dragging ? 'grabbing' : unplaced.length > 0 ? 'crosshair' : 'grab')
              : 'default',
            background: bgUrl
              ? `url(${bgUrl}) center/cover no-repeat`
              : `
                  linear-gradient(rgba(212,208,200,0.25) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(212,208,200,0.25) 1px, transparent 1px),
                  #F4F1EB
                `,
            backgroundSize: bgUrl ? 'cover' : '40px 40px, 40px 40px, auto',
          }}
        >
          {/* Kein Bild + keine platzierten Plätze */}
          {placed.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', textAlign: 'center', padding: 40,
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Platzplan vorhanden</div>
              <div style={{ fontSize: 13 }}>
                Klicke auf „Platzplan bearbeiten" und dann auf die Karte<br />
                um Stellplätze zu platzieren.
              </div>
            </div>
          )}

          {/* Stellplatz-Marker */}
          {sites.filter(s => s.x_pos != null && s.y_pos != null).map(site => {
            const pos = getPos(site)
            const cfg = STATUS_COLOR[site.status]
            const isDraggingThis = dragging?.id === site.id
            const isPopupOpen = popup?.site?.id === site.id

            return (
              <div
                key={site.id}
                onMouseDown={e => onMarkerMouseDown(e, site)}
                onClick={e => onMarkerClick(e, site)}
                style={{
                  position: 'absolute',
                  left:   `${pos.x}%`,
                  top:    `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isDraggingThis ? 40 : isPopupOpen ? 30 : 10,
                  cursor: editMode ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                  userSelect: 'none',
                  transition: isDraggingThis ? 'none' : 'transform 0.1s',
                }}
              >
                {/* Marker */}
                <div style={{
                  width:  44,
                  height: 44,
                  borderRadius: 8,
                  background: cfg.bg,
                  border: `3px solid ${isPopupOpen ? '#fff' : cfg.border}`,
                  boxShadow: isPopupOpen
                    ? `0 0 0 3px ${cfg.bg}, 0 4px 16px rgba(0,0,0,0.3)`
                    : isDraggingThis
                    ? '0 8px 24px rgba(0,0,0,0.3)'
                    : '0 2px 6px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: isDraggingThis ? 'none' : 'box-shadow 0.12s',
                  transform: isDraggingThis ? 'scale(1.12)' : 'scale(1)',
                }}>
                  <span style={{
                    color: '#fff',
                    fontSize: site.name.length > 4 ? 8 : site.name.length > 3 ? 9 : 11,
                    fontWeight: 700,
                    fontFamily: "'Sora', sans-serif",
                    lineHeight: 1.1,
                    textAlign: 'center',
                    padding: '0 2px',
                    wordBreak: 'break-all',
                  }}>
                    {site.name}
                  </span>
                </div>

                {/* Popup */}
                {isPopupOpen && (
                  <SitePopup
                    site={site}
                    pos={pos}
                    onClose={() => setPopup(null)}
                    onStatusChange={(s, status) => { onStatusChange(s, status); setPopup(null) }}
                    onEdit={(s) => { setPopup(null); onEdit(s) }}
                  />
                )}
              </div>
            )
          })}

          {/* Editier-Modus Overlay-Hinweis */}
          {editMode && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(27,67,50,0.85)', color: '#fff',
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              pointerEvents: 'none', backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}>
              ✏️ Stellplätze verschieben · Klick auf freie Fläche platziert „{unplaced[0]?.name || '–'}"
            </div>
          )}
        </div>

        {/* ── Seitenpanel: nicht platzierte Stellplätze ── */}
        {(editMode || unplaced.length > 0) && (
          <div style={{
            width: 200,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg)',
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-muted)',
            }}>
              Nicht platziert ({unplaced.length})
            </div>
            {unplaced.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                ✅ Alle Stellplätze sind platziert
              </div>
            ) : (
              unplaced.map(s => {
                const cfg = STATUS_COLOR[s.status]
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 14px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                      background: editMode && unplaced[0]?.id === s.id ? '#FEF3C7' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 5,
                      background: cfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#fff',
                      flexShrink: 0,
                    }}>{s.name}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type}</div>
                    </div>
                    {editMode && unplaced[0]?.id === s.id && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#92400E' }}>← Nächster</span>
                    )}
                  </div>
                )
              })
            )}
            {editMode && (
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
