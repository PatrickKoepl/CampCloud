import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { Icon } from './ui'

// ─── Leaflet Standard-Icon-Bug in Vite fixen ─────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

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
  { type: 'power',      emoji: '⚡', label: 'Strom' },
  { type: 'water',      emoji: '💧', label: 'Wasser' },
  { type: 'fire',       emoji: '🔥', label: 'Feuerstelle' },
  { type: 'playground', emoji: '🛝', label: 'Spielplatz' },
  { type: 'trash',      emoji: '🗑️', label: 'Müll' },
  { type: 'pool',       emoji: '🏊', label: 'Pool/See' },
  { type: 'dog',        emoji: '🐕', label: 'Hundewiese' },
  { type: 'wash',       emoji: '🧺', label: 'Waschmaschine' },
]
const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.type, s]))

// ─── Icon-Factories ──────────────────────────────────────────────────────────
const createSiteIcon = (site, isOpen, hasBooking) => {
  const cfg = STATUS_COLOR[site.status] || STATUS_COLOR.free
  const fs  = site.name.length > 4 ? 8 : site.name.length > 3 ? 10 : 12
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:44px;height:44px">
      <div style="
        width:44px;height:44px;border-radius:8px;
        background:${cfg.bg};
        border:3px solid ${isOpen ? '#fff' : cfg.border};
        box-shadow:${isOpen
          ? `0 0 0 3px ${cfg.bg},0 4px 16px rgba(0,0,0,.35)`
          : '0 2px 8px rgba(0,0,0,.25)'};
        display:flex;align-items:center;justify-content:center;
        font-weight:700;color:#fff;font-family:Sora,sans-serif;
        font-size:${fs}px;line-height:1.1;text-align:center;
        word-break:break-all;padding:0 2px;box-sizing:border-box;cursor:pointer;
      ">${site.name}</div>
      ${hasBooking ? '<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;background:#EF4444;border:2px solid #fff;"></div>' : ''}
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -28],
  })
}

const createSymbolIcon = (type) => {
  const def = SYMBOL_MAP[type] || { emoji: '❓' }
  return L.divIcon({
    className: '',
    html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 4px rgba(0,0,0,.45));cursor:pointer;">${def.emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  })
}

// ─── Klick-Handler (muss innerhalb von MapContainer leben) ───────────────────
function MapClickHandler({ enabled, onMapClick }) {
  useMapEvents({ click: enabled ? onMapClick : () => {} })
  return null
}

// ─── Karte neu zentrieren wenn campground-Koordinaten gesetzt werden ──────────
function MapRecenter({ center, zoom }) {
  const map = useMapEvents({})
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true })
  }, [center?.[0], center?.[1]]) // eslint-disable-line
  return null
}

// ─── Popup-Inhalt für einen Stellplatz ───────────────────────────────────────
function SitePopupContent({ site, hasBooking, editMode, onStatusChange, onEdit, onDelete, onRemoveFromMap }) {
  const [localStatus, setLocalStatus] = useState(site.status)

  const handleStatus = (s) => {
    setLocalStatus(s)
    onStatusChange(site, s)
  }

  return (
    <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{site.name}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
        {site.type}{site.size ? ` · ${site.size}` : ''}{site.electric ? ' · ⚡' : ''}{site.water ? ' · 💧' : ''}
      </div>

      {/* Status-Buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <button key={s} onClick={() => handleStatus(s)} style={{
            flex: 1, padding: '5px 2px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            cursor: 'pointer', border: `2px solid ${localStatus === s ? c.border : 'transparent'}`,
            background: localStatus === s ? c.bg : '#F3F4F6',
            color: localStatus === s ? '#fff' : '#6B7280',
          }}>{c.label}</button>
        ))}
      </div>

      {/* Aktionen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button onClick={() => onEdit(site)} style={btnStyle()}>✏️ Bearbeiten</button>
        <button onClick={() => onRemoveFromMap(site)} style={btnStyle('#FEF3C7', '#92400E', '#FCD34D')}>
          📍 Von Karte entfernen
        </button>
        {hasBooking ? (
          <div style={{ padding: '7px', borderRadius: 6, fontSize: 11, textAlign: 'center',
            background: '#FFF0F0', border: '1px solid #FECACA', color: '#991B1B' }}>
            ⛔ Hat aktive Buchungen — Löschen gesperrt
          </div>
        ) : (
          <button onClick={() => onDelete(site)} style={btnStyle('#FEF2F2', '#991B1B', '#FECACA')}>
            🗑 Stellplatz löschen
          </button>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg = '#F9FAFB', color = 'inherit', borderColor = '#E5E7EB') {
  return {
    width: '100%', padding: '7px', borderRadius: 6, fontSize: 12,
    cursor: 'pointer', border: `1px solid ${borderColor}`, background: bg, color,
    textAlign: 'left',
  }
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function CampMap({
  sites, campground, bookings = [],
  onStatusChange, onEdit, onDelete, onPositionSave,
}) {
  const [editMode, setEditMode] = useState(false)
  const [mode, setMode]         = useState('sites') // 'sites' | 'symbols'
  const [selectedSymbol, setSelectedSymbol] = useState(null)
  const [mapSymbols, setMapSymbols] = useState([])
  const [openPopup, setOpenPopup]   = useState(null) // site.id
  const [saving, setSaving]         = useState(false)

  const markerRefs = useRef({})

  const bookedSiteIds = new Set(
    bookings
      .filter(b => !['cancelled', 'departed'].includes(b.status))
      .map(b => b.site_id).filter(Boolean)
  )

  const placed   = sites.filter(s => s.lat != null && s.lng != null)
  const unplaced = sites.filter(s => s.lat == null || s.lng == null)

  // Standardmittelpunkt: Campingplatz-Koordinaten oder Bayern-Mitte als Fallback
  const hasGPS = !!(campground?.lat && campground?.lng)
  const center  = hasGPS ? [campground.lat, campground.lng] : [48.5, 12.0]
  const zoom    = hasGPS ? 18 : 8

  const loadSymbols = useCallback(async () => {
    if (!campground) return
    const { data } = await supabase.from('map_symbols')
      .select('*').eq('campground_id', campground.id)
    setMapSymbols((data || []).filter(s => s.lat != null && s.lng != null))
  }, [campground])

  useEffect(() => { loadSymbols() }, [loadSymbols])

  // Map-Klick: Stellplatz oder Symbol platzieren
  const handleMapClick = useCallback(async (e) => {
    if (!editMode) return
    const { lat, lng } = e.latlng

    if (mode === 'symbols' && selectedSymbol) {
      setSaving(true)
      await supabase.from('map_symbols').insert({
        campground_id: campground.id,
        symbol_type: selectedSymbol,
        lat, lng,
        label: SYMBOL_MAP[selectedSymbol]?.label || '',
      })
      await loadSymbols()
      setSaving(false)
    } else if (mode === 'sites' && unplaced.length > 0) {
      setSaving(true)
      await onPositionSave(unplaced[0].id, lat, lng)
      setSaving(false)
    }
  }, [editMode, mode, selectedSymbol, unplaced, campground, loadSymbols, onPositionSave])

  const removeFromMap = useCallback(async (site) => {
    setOpenPopup(null)
    setSaving(true)
    await onPositionSave(site.id, null, null)
    setSaving(false)
  }, [onPositionSave])

  const deleteSymbol = useCallback(async (id) => {
    await supabase.from('map_symbols').delete().eq('id', id)
    await loadSymbols()
  }, [loadSymbols])

  const handleDelete = useCallback((site) => {
    setOpenPopup(null)
    onDelete(site.id)
  }, [onDelete])

  // Cursor-Stil je nach Modus
  const cursor = editMode
    ? mode === 'symbols' && selectedSymbol ? 'crosshair'
    : mode === 'sites' && unplaced.length > 0 ? 'crosshair'
    : 'grab'
    : 'grab'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 18px', borderBottom: '1px solid var(--border)',
        background: editMode ? '#FEF3C7' : 'var(--card)',
        transition: 'background .2s', flexWrap: 'wrap', gap: 8,
      }}>
        {/* Legende */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg }} />
              <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
            </div>
          ))}
          {saving && <span style={{ color: 'var(--green-700)', fontWeight: 500 }}>💾 Speichern…</span>}
          {!hasGPS && (
            <span style={{ color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
              ⚠ GPS-Koordinaten in Einstellungen setzen
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setEditMode(v => !v); setSelectedSymbol(null); setMode('sites') }}
          >
            {editMode ? <><Icon name="check" size={13} /> Fertig</> : <><Icon name="edit" size={13} /> Bearbeiten</>}
          </button>
        </div>
      </div>

      {/* ── Bearbeitungs-Palette ── */}
      {editMode && (
        <div style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC', padding: '10px 18px' }}>
          {/* Modus-Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: mode === 'symbols' ? 10 : 0 }}>
            {[['sites', '📍 Stellplätze'], ['symbols', '🎨 Symbole']].map(([m, lbl]) => (
              <button key={m}
                onClick={() => { setMode(m); setSelectedSymbol(null) }}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  border: `2px solid ${mode === m ? '#1B4332' : 'var(--border)'}`,
                  background: mode === m ? '#1B4332' : '#fff',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                }}>{lbl}</button>
            ))}
          </div>

          {/* Symbol-Palette */}
          {mode === 'symbols' && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {SYMBOLS.map(s => (
                <button key={s.type}
                  onClick={() => setSelectedSymbol(t => t === s.type ? null : s.type)}
                  title={s.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '5px 8px', borderRadius: 8, cursor: 'pointer', minWidth: 50,
                    border: `2px solid ${selectedSymbol === s.type ? '#1D4ED8' : 'var(--border)'}`,
                    background: selectedSymbol === s.type ? '#EFF6FF' : '#fff',
                    fontSize: 20,
                  }}>
                  {s.emoji}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.1, textAlign: 'center' }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Hinweis */}
          <div style={{ marginTop: 8, fontSize: 12, color: '#1B4332', fontWeight: 500,
            background: 'rgba(27,67,50,0.08)', padding: '5px 12px', borderRadius: 6 }}>
            {mode === 'sites'
              ? unplaced.length > 0
                ? `📍 Klicke auf die Karte um „${unplaced[0].name}" zu platzieren · Marker verschieben per Drag`
                : '✓ Alle Stellplätze platziert · Marker per Drag verschieben · Klicken für Menü'
              : selectedSymbol
                ? `${SYMBOL_MAP[selectedSymbol]?.emoji} Klicke auf die Karte zum Platzieren · Rechtsklick auf Symbol = löschen`
                : '← Symbol aus der Palette wählen'}
          </div>
        </div>
      )}

      {/* ── Map + Sidebar ── */}
      <div style={{ display: 'flex' }}>
        {/* Karte */}
        <div style={{ flex: 1, position: 'relative' }}>
          {!hasGPS && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                background: 'rgba(254,243,199,0.97)', border: '2px solid #FCD34D',
                borderRadius: 14, padding: '22px 32px', textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxWidth: 380,
                pointerEvents: 'auto',
              }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#92400E' }}>
                  GPS-Koordinaten nicht gesetzt
                </div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
                  Gehe zu <strong>Einstellungen → Standort</strong> und gib die GPS-Koordinaten deines Campingplatzes ein,
                  damit der Platzplan auf der richtigen Position angezeigt wird.
                </div>
              </div>
            </div>
          )}

          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: 580, width: '100%', cursor }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={22}
            />

            <MapRecenter center={center} zoom={zoom} />

            {/* Klick-Handler nur im Edit-Modus */}
            <MapClickHandler
              enabled={editMode && (
                (mode === 'sites' && unplaced.length > 0) ||
                (mode === 'symbols' && !!selectedSymbol)
              )}
              onMapClick={handleMapClick}
            />

            {/* Stellplatz-Marker */}
            {placed.map(site => {
              const hasBooking = bookedSiteIds.has(site.id)
              const isOpen     = openPopup === site.id
              return (
                <Marker
                  key={site.id}
                  position={[site.lat, site.lng]}
                  icon={createSiteIcon(site, isOpen, hasBooking)}
                  draggable={editMode && mode === 'sites'}
                  ref={el => { if (el) markerRefs.current[site.id] = el }}
                  eventHandlers={{
                    dragend: async (e) => {
                      const { lat, lng } = e.target.getLatLng()
                      setSaving(true)
                      await onPositionSave(site.id, lat, lng)
                      setSaving(false)
                    },
                    popupopen:  () => setOpenPopup(site.id),
                    popupclose: () => setOpenPopup(p => p === site.id ? null : p),
                  }}
                >
                  <Popup closeButton={true} minWidth={210} maxWidth={260}>
                    <SitePopupContent
                      site={site}
                      hasBooking={hasBooking}
                      editMode={editMode}
                      onStatusChange={onStatusChange}
                      onEdit={(s) => { markerRefs.current[site.id]?.closePopup(); onEdit(s) }}
                      onDelete={handleDelete}
                      onRemoveFromMap={removeFromMap}
                    />
                  </Popup>
                </Marker>
              )
            })}

            {/* Symbol-Marker */}
            {mapSymbols.map(sym => {
              const def = SYMBOL_MAP[sym.symbol_type] || { emoji: '❓', label: sym.symbol_type }
              return (
                <Marker
                  key={sym.id}
                  position={[sym.lat, sym.lng]}
                  icon={createSymbolIcon(sym.symbol_type)}
                  draggable={editMode && mode === 'symbols'}
                  eventHandlers={{
                    dragend: async (e) => {
                      const { lat, lng } = e.target.getLatLng()
                      await supabase.from('map_symbols').update({ lat, lng }).eq('id', sym.id)
                      // kein loadSymbols nötig — Position nur DB-seitig aktualisieren
                    },
                  }}
                >
                  <Popup closeButton minWidth={140}>
                    <div style={{ textAlign: 'center', padding: '6px 4px' }}>
                      <div style={{ fontSize: 30, marginBottom: 4 }}>{def.emoji}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{def.label}</div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await deleteSymbol(sym.id)
                        }}
                        style={{
                          width: '100%', padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                          background: '#FEF2F2', border: '1px solid #FECACA',
                          borderRadius: 6, color: '#991B1B', fontWeight: 600,
                        }}
                      >
                        🗑 Entfernen
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* ── Sidebar: nicht platzierte Stellplätze ── */}
        {(editMode && mode === 'sites') || (!editMode && unplaced.length > 0) ? (
          <div style={{
            width: 192, borderLeft: '1px solid var(--border)',
            background: 'var(--bg)', overflowY: 'auto', maxHeight: 580, flexShrink: 0,
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.5px', color: 'var(--text-muted)',
            }}>
              Nicht platziert ({unplaced.length})
            </div>
            {unplaced.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                ✅ Alle platziert
              </div>
            ) : unplaced.map((s, i) => {
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
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
