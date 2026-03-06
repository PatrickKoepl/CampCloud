import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon, Toast } from '../components/ui'

export default function Settings() {
  const { campground, refreshCampground, signOut } = useAuth()
  // BUG FIX: useState with campground as initial value only reads it once.
  // If campground loads AFTER the component mounts, the form would stay empty.
  // useEffect syncs form state whenever campground changes.
  const toForm = (cg) => ({
    name:          cg?.name          || '',
    email:         cg?.email         || '',
    phone:         cg?.phone         || '',
    address:       cg?.address       || '',
    website:       cg?.website       || '',
    checkin_time:  cg?.checkin_time  || '14:00',
    checkout_time: cg?.checkout_time || '11:00',
    lat:           cg?.lat           ?? '',
    lng:           cg?.lng           ?? '',
  })

  const [form, setForm] = useState(() => toForm(campground))

  useEffect(() => { setForm(toForm(campground)) }, [campground]) // eslint-disable-line
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [toast, setToast]   = useState('')
  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const geocode = async () => {
    if (!form.address) { toast$('Bitte zuerst die Adresse eintragen'); return }
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`)
      const data = await res.json()
      if (data?.[0]) {
        setForm(f => ({ ...f, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }))
        toast$('✓ Koordinaten gefunden: ' + data[0].display_name.slice(0, 60))
      } else {
        toast$('⛔ Adresse nicht gefunden — bitte manuell eingeben')
      }
    } catch { toast$('⛔ Geocoding fehlgeschlagen') }
    setGeocoding(false)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('campgrounds').update(form).eq('id', campground.id)
    setSaving(false)
    if (error) { toast$('Fehler beim Speichern: ' + error.message); return }
    await refreshCampground()
    toast$('Einstellungen gespeichert')
  }

  const sections = [
    { label: 'Campingplatz',    active: true },
    { label: 'Benachrichtigungen', active: false },
    { label: 'Sicherheit',      active: false },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Einstellungen</div>
          <div className="page-subtitle">Verwalte deinen Campingplatz und dein Konto</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sections.map(s => (
            <div
              key={s.label}
              style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                cursor: s.active ? 'default' : 'pointer',
                background: s.active ? 'var(--green-100)' : 'transparent',
                color: s.active ? 'var(--green-900)' : 'var(--text-muted)',
              }}
            >
              {s.label}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
            <div
              onClick={signOut}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Icon name="logout" size={14} /> Abmelden
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Campingplatz-Informationen</div>
          </div>
          <div style={{ padding: '22px 26px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name des Campingplatzes</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-Mail-Adresse</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@mein-camping.de" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 …" />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.mein-camping.de" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Musterstraße 1, 12345 Musterstadt" />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 18px' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-900)', marginBottom: 14 }}>Check-in / Check-out</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Früheste Check-in Zeit</label>
                <input className="form-input" type="time" value={form.checkin_time} onChange={e => set('checkin_time', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Späteste Check-out Zeit</label>
                <input className="form-input" type="time" value={form.checkout_time} onChange={e => set('checkout_time', e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 18px' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-900)', marginBottom: 6 }}>
              📍 Platzplan-Position (GPS)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Wird für den interaktiven Platzplan (OpenStreetMap) benötigt. Automatisch aus der Adresse ermitteln oder manuell eingeben.
            </div>
            <div style={{ marginBottom: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={geocode} disabled={geocoding}>
                {geocoding ? '🔍 Suche…' : '🔍 Aus Adresse ermitteln'}
              </button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Breitengrad (Latitude)</label>
                <input className="form-input" type="number" step="0.000001"
                  value={form.lat} onChange={e => set('lat', e.target.value)}
                  placeholder="z.B. 48.137154" />
              </div>
              <div className="form-group">
                <label className="form-label">Längengrad (Longitude)</label>
                <input className="form-input" type="number" step="0.000001"
                  value={form.lng} onChange={e => set('lng', e.target.value)}
                  placeholder="z.B. 11.576124" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <Icon name="check" /> {saving ? 'Speichern…' : 'Änderungen speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="card" style={{ marginTop: 20, padding: '16px 22px', background: 'var(--green-100)', border: '1px solid var(--green-200)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Icon name="info" size={18} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Open Source & Kostenlos</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              CampCloud ist vollständig Open Source und kostenlos. Hosting über Vercel (gratis), Datenbank über Supabase (gratis bis 500 MB).
              Kein Abo, keine versteckten Kosten.
            </div>
          </div>
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  )
}
