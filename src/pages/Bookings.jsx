import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon, Modal, Toast } from '../components/ui'
import { fmt, fmtDate, nights, STATUS, PAYMENT, validateBookingDates } from '../lib/utils'
import InvoiceModal, { DunningModal } from '../components/Invoice'

// ─── Form ─────────────────────────────────────────────────────────────────────
// Zusatzleistungen die manuell hinzugefügt werden können
const EXTRA_SERVICES = [
  { key: 'trash',     label: 'Müllgebühr',          unit: '/Nacht', defaultFactor: 'nights' },
  { key: 'dog',       label: 'Hundpauschale',        unit: '/Nacht', defaultFactor: 'nights' },
  { key: 'tourist',   label: 'Kurtaxe',              unit: '/Person/Nacht', defaultFactor: 'persons_nights' },
  { key: 'wood',      label: 'Brennholz',            unit: 'pauschal', defaultFactor: 'flat' },
  { key: 'wash',      label: 'Waschmaschinen Jeton', unit: 'je Jeton', defaultFactor: 'flat' },
  { key: 'breakfast', label: 'Frühstück/Person',     unit: '/Person/Tag', defaultFactor: 'persons_nights' },
  { key: 'other',     label: 'Sonstiges',            unit: 'pauschal', defaultFactor: 'flat' },
]

function buildLineItems(site, pl, n, persons) {
  if (!pl || n <= 0) return []
  const items = []
  if ((pl.base_price || 0) > 0)
    items.push({ key: 'base', label: 'Grundpreis Stellplatz', qty: n, unit: '/Nacht', unitPrice: pl.base_price, amount: pl.base_price * n, locked: false })
  if ((pl.per_person || 0) > 0)
    items.push({ key: 'person', label: 'Personengebühr', qty: persons * n, unit: 'Pers.×Nacht', unitPrice: pl.per_person, amount: pl.per_person * persons * n, locked: false })
  if (site?.electric && (pl.electricity || 0) > 0)
    items.push({ key: 'elec', label: 'Stromgebühr', qty: n, unit: '/Nacht', unitPrice: pl.electricity, amount: pl.electricity * n, locked: false })
  return items
}

function BookingForm({ initial, sites, priceLists, onSave, onClose }) {
  const blank = {
    guest_name: '', email: '', site_id: '', site_name: '',
    type: 'Stellplatz', arrival: '', departure: '',
    persons: 2, status: 'confirmed', payment: 'pending', total: 0, notes: '',
    line_items: null,
  }
  const [form, setForm]     = useState(initial || blank)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [lineItems, setLineItems] = useState([])   // [{ key, label, qty, unit, unitPrice, amount }]
  const [extras, setExtras]       = useState([])   // zusätzliche manuelle Zeilen
  const [extraKey, setExtraKey]     = useState('')
  const [extraPrice, setExtraPrice] = useState('')

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })) }

  const onSiteChange = (siteId) => {
    const site = sites.find(s => s.id === siteId)
    setForm(f => ({ ...f, site_id: siteId, site_name: site?.name || '', type: site?.type || f.type }))
    setErrors(e => ({ ...e, site_id: null }))
  }

  // Nächte
  const nightCount = nights(form.arrival, form.departure)

  // ── Preislisten-Positionen aktualisieren ──────────────────────────────────
  useEffect(() => {
    const site = sites.find(s => s.id === form.site_id)
    const n    = nightCount
    if (!site || n <= 0 || !priceLists?.length) { setLineItems([]); return }

    const pl = priceLists.find(p => p.active && p.type === site.type)
           || priceLists.find(p => p.active)
    if (!pl) { setLineItems([]); return }

    const items = buildLineItems(site, pl, n, form.persons)
    setLineItems(items)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.site_id, form.arrival, form.departure, form.persons])

  // Gesamtbetrag = Summe aller Positionen
  useEffect(() => {
    const all = [...lineItems, ...extras]
    if (all.length === 0) return
    const total = Math.round(all.reduce((s, i) => s + Number(i.amount || 0), 0) * 100) / 100
    setForm(f => ({ ...f, total }))
  }, [lineItems, extras])

  // Beim Öffnen: site_id rückwärts ermitteln + gespeicherte line_items laden
  useEffect(() => {
    if (initial?.site_id) return
    if (initial?.site_name && sites.length > 0) {
      const match = sites.find(s => s.name === initial.site_name)
      if (match) setForm(f => ({ ...f, site_id: match.id }))
    }
  }, [initial, sites]) // eslint-disable-line

  const updateLineAmount = (idx, newAmount) => {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, amount: +newAmount } : item))
  }
  const updateExtraAmount = (idx, newAmount) => {
    setExtras(prev => prev.map((item, i) => i === idx ? { ...item, amount: +newAmount } : item))
  }
  const removeExtra = (idx) => setExtras(prev => prev.filter((_, i) => i !== idx))

  const addExtra = () => {
    const svc = EXTRA_SERVICES.find(x => x.key === extraKey)
    const price = parseFloat(extraPrice) || 0
    if (!svc || price <= 0) return
    const n = nightCount
    const p = form.persons
    const amount = svc.defaultFactor === 'nights'         ? price * n
                 : svc.defaultFactor === 'persons_nights' ? price * p * n
                 : price
    setExtras(prev => [...prev, { key: svc.key + '_' + Date.now(), label: svc.label, qty: 1, unit: svc.unit, unitPrice: price, amount }])
    setExtraKey(''); setExtraPrice('')
  }

  const validate = () => {
    const errs = {}
    if (!form.guest_name.trim()) errs.guest_name = 'Pflichtfeld'
    if (!form.site_id && !form.site_name) errs.site_id = 'Bitte Stellplatz wählen'
    const dateErr = validateBookingDates(form.arrival, form.departure)
    if (dateErr) errs.dates = dateErr
    if (form.persons < 1 || form.persons > 100) errs.persons = 'Gültige Personenzahl (1–100)'
    if (form.total < 0) errs.total = 'Darf nicht negativ sein'
    return errs
  }

  const handle = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    const allItems = [...lineItems, ...extras]
    await onSave({ ...form, line_items: allItems.length > 0 ? allItems : null })
    setSaving(false)
  }

  const hasPricing = lineItems.length > 0

  return (
    <Modal
      title={initial?.id ? 'Buchung bearbeiten' : 'Neue Buchung'}
      onClose={onClose}
      size="modal-lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={handle} disabled={saving}>
          <Icon name="check" /> {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </>}
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Gastname <span className="req">*</span></label>
          <input className={`form-input ${errors.guest_name ? 'input-error' : ''}`}
            value={form.guest_name} onChange={e => set('guest_name', e.target.value)} placeholder="Max Mustermann" />
          {errors.guest_name && <div className="field-error">{errors.guest_name}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">E-Mail</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="gast@email.de" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Stellplatz <span className="req">*</span></label>
          <select className={`form-select ${errors.site_id ? 'input-error' : ''}`}
            value={form.site_id || ''} onChange={e => onSiteChange(e.target.value)}>
            <option value="">Stellplatz wählen…</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type}){s.status === 'blocked' ? ' — Gesperrt' : ''}</option>)}
          </select>
          {errors.site_id && <div className="field-error">{errors.site_id}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Typ</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option>Stellplatz</option><option>Mietunterkunft</option><option>Dauercamping</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Anreise <span className="req">*</span></label>
          <input className={`form-input ${errors.dates ? 'input-error' : ''}`}
            type="date" value={form.arrival} onChange={e => set('arrival', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Abreise <span className="req">*</span></label>
          <input className={`form-input ${errors.dates ? 'input-error' : ''}`}
            type="date" value={form.departure} min={form.arrival || undefined}
            onChange={e => set('departure', e.target.value)} />
        </div>
      </div>
      {errors.dates && <div className="field-error" style={{ marginTop: -8, marginBottom: 8 }}>⚠️ {errors.dates}</div>}
      {nightCount > 0 && !errors.dates && (
        <div style={{ fontSize: 12, color: 'var(--green-700)', marginTop: -8, marginBottom: 10, fontWeight: 500 }}>
          ✓ {nightCount} Nacht{nightCount !== 1 ? 'e' : ''}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Personen</label>
          <input className={`form-input ${errors.persons ? 'input-error' : ''}`}
            type="number" min="1" max="100" value={form.persons}
            onChange={e => set('persons', Math.max(1, +e.target.value))} />
          {errors.persons && <div className="field-error">{errors.persons}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Zahlung</label>
          <select className="form-select" value={form.payment} onChange={e => set('payment', e.target.value)}>
            {Object.entries(PAYMENT).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Kostenpositionen ── */}
      {hasPricing && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: '#1B4332', color: '#fff', padding: '8px 14px', fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💰 Kostenpositionen</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>Beträge sind editierbar</span>
          </div>

          {/* Preislisten-Positionen */}
          {lineItems.map((item, idx) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? '#FAFAFA' : '#fff' }}>
              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                  {item.qty} × {item.unit} × {fmt(item.unitPrice)}
                </span>
              </div>
              <input
                type="number" min="0" step="0.5"
                value={item.amount}
                onChange={e => updateLineAmount(idx, e.target.value)}
                style={{ width: 90, textAlign: 'right', fontWeight: 600, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 14 }}>€</span>
            </div>
          ))}

          {/* Extras */}
          {extras.map((item, idx) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: '#FFF9F0' }}>
              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>{item.unit}</span>
              </div>
              <input
                type="number" min="0" step="0.5"
                value={item.amount}
                onChange={e => updateExtraAmount(idx, e.target.value)}
                style={{ width: 90, textAlign: 'right', fontWeight: 600, padding: '4px 8px', border: '1px solid #FCD34D', borderRadius: 6, fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 14 }}>€</span>
              <button onClick={() => removeExtra(idx)} style={{ width: 22, height: 22, borderRadius: 5, background: '#FEE2E2', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}

          {/* Zusatzleistung hinzufügen — immer sichtbar */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)', background: '#F8FAFC', flexWrap: 'wrap' }}>
            <select value={extraKey} onChange={e => setExtraKey(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', flex: '1 1 160px' }}>
              <option value="">+ Zusatzleistung wählen…</option>
              {EXTRA_SERVICES.map(s => <option key={s.key} value={s.key}>{s.label} ({s.unit})</option>)}
            </select>
            <input type="number" min="0" step="0.5" placeholder="€ Einzelpreis"
              value={extraPrice} onChange={e => setExtraPrice(e.target.value)}
              style={{ width: 110, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }} />
            <button type="button" onClick={addExtra} disabled={!extraKey || !extraPrice}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none',
                background: extraKey && extraPrice ? '#1B4332' : '#E5E7EB',
                color: extraKey && extraPrice ? '#fff' : '#9CA3AF', cursor: extraKey && extraPrice ? 'pointer' : 'default' }}>
              Hinzufügen
            </button>
          </div>

          {/* Summe */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', background: '#F0FDF4' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1B4332' }}>
              Gesamt: {fmt(form.total)}
            </div>
          </div>
        </div>
      )}

      {/* Manueller Gesamtbetrag (wenn keine Preisliste) */}
      {!hasPricing && (
        <div className="form-group">
          <label className="form-label">Gesamtbetrag (€)</label>
          <input className={`form-input ${errors.total ? 'input-error' : ''}`}
            type="number" min="0" step="0.01" value={form.total}
            onChange={e => set('total', Math.max(0, +e.target.value))} />
          {!form.site_id && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Stellplatz wählen für automatische Preisberechnung</div>}
          {errors.total && <div className="field-error">{errors.total}</div>}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Notizen</label>
        <textarea className="form-textarea" rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Interne Notizen…" />
      </div>
    </Modal>
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────
function BookingDetail({ booking, campground, onEdit, onDelete, onClose }) {
  const [showInvoice, setShowInvoice] = useState(false)
  const [showDunning, setShowDunning] = useState(false)
  const daysPending = Math.floor((Date.now() - new Date(booking.created_at)) / 86400000)
  const isOverdue = booking.payment === 'pending' && !['cancelled','departed'].includes(booking.status) && daysPending >= 14

  if (!booking) return null
  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}><Icon name="back" /> Zurück</button>
          <div>
            <div className="page-title">{booking.guest_name}</div>
            <div className="page-subtitle">Buchung · Platz {booking.site_name}</div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={onEdit}><Icon name="edit" /> Bearbeiten</button>
          <button className="btn btn-danger" onClick={onDelete}><Icon name="trash" /> Löschen</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><div className="card-title">Buchungsdetails</div></div>
          <div style={{ padding: '16px 20px' }}>
            {[
              ['Gast',       booking.guest_name],
              ['E-Mail',     booking.email || '–'],
              ['Stellplatz', booking.site_name],
              ['Typ',        booking.type],
              ['Anreise',    fmtDate(booking.arrival)],
              ['Abreise',    fmtDate(booking.departure)],
              ['Nächte',     nights(booking.arrival, booking.departure)],
              ['Personen',   booking.persons],
            ].map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="kv-key">{k}</span>
                <span className="kv-val">{v}</span>
              </div>
            ))}
            {booking.notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                {booking.notes}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Status & Zahlung</div></div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <span className={`badge ${STATUS[booking.status]?.cls}`} style={{ fontSize: 13, padding: '5px 13px' }}>
                {STATUS[booking.status]?.label}
              </span>
              <span className={`badge ${PAYMENT[booking.payment]?.cls}`} style={{ fontSize: 13, padding: '5px 13px' }}>
                {PAYMENT[booking.payment]?.label}
              </span>
              {isOverdue && (
                <span className="badge badge-amber" style={{ fontSize: 13, padding: '5px 13px' }}>
                  ⚠️ {daysPending} Tage offen
                </span>
              )}
            </div>
            <div style={{ background: 'var(--green-100)', border: '1px solid var(--green-200)', borderRadius: 10, padding: '18px 22px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Gesamtbetrag</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--green-900)' }}>
                {fmt(booking.total)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowInvoice(true)}>
                  <Icon name="invoice" /> Rechnung
                </button>
                {booking.email && (
                  <a className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}
                    href={`mailto:${booking.email}?subject=Ihre Buchung bei ${campground?.name || 'uns'}`}>
                    <Icon name="mail" /> E-Mail
                  </a>
                )}
              </div>
              {isOverdue && (
                <button className="btn btn-secondary" style={{ width: '100%', borderColor: '#FCD34D', color: '#92400E' }}
                  onClick={() => setShowDunning(true)}>
                  ⚠️ Zahlungserinnerung senden
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showInvoice && <InvoiceModal booking={booking} campground={campground} onClose={() => setShowInvoice(false)} />}
      {showDunning && <DunningModal booking={booking} campground={campground} onClose={() => setShowDunning(false)} />}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Bookings() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const { id: detailId } = useParams()

  const [bookings, setBookings]     = useState([])
  const [sites, setSites]           = useState([])
  const [priceLists, setPriceLists] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusF, setStatusF]       = useState('all')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState(null)
  const [toast, setToast]           = useState('')

  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    if (!campground) return
    const [{ data: b, error: be }, { data: s }, { data: p }] = await Promise.all([
      supabase.from('bookings').select('*').eq('campground_id', campground.id).order('arrival', { ascending: false }),
      supabase.from('sites').select('*').eq('campground_id', campground.id).order('name'),
      supabase.from('price_lists').select('*').eq('campground_id', campground.id).eq('active', true),
    ])
    if (be) { console.error(be.message); return }
    setBookings(b || [])
    setSites(s || [])
    setPriceLists(p || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  // ── Gast automatisch anlegen / verknüpfen ─────────────────────────────────
  const resolveGuest = async (guestName, email) => {
    if (!guestName) return null
    let existing = null
    if (email) {
      const { data } = await supabase.from('guests')
        .select('id, visits').eq('campground_id', campground.id).eq('email', email).maybeSingle()
      existing = data
    }
    if (!existing) {
      const { data } = await supabase.from('guests')
        .select('id, visits').eq('campground_id', campground.id).ilike('name', guestName.trim()).maybeSingle()
      existing = data
    }
    if (existing) {
      await supabase.from('guests').update({
        visits: (existing.visits || 0) + 1,
        last_visit: new Date().toISOString().slice(0, 10),
        ...(email ? { email } : {}),
      }).eq('id', existing.id)
      return existing.id
    } else {
      const { data } = await supabase.from('guests').insert({
        campground_id: campground.id,
        name: guestName.trim(), email: email || null,
        visits: 1, last_visit: new Date().toISOString().slice(0, 10),
      }).select('id').single()
      return data?.id ?? null
    }
  }

  // ── Doppelbuchungsprüfung ─────────────────────────────────────────────────
  const checkDoubleBooking = async (siteId, arrival, departure, excludeId = null) => {
    if (!siteId || !arrival || !departure) return false
    let q = supabase.from('bookings')
      .select('id, guest_name, arrival, departure')
      .eq('campground_id', campground.id)
      .eq('site_id', siteId)
      .not('status', 'in', '("cancelled","departed")')
      // Überschneidung: bestehende Buchung beginnt vor unserer Abreise UND endet nach unserer Anreise
      .lt('arrival', departure)
      .gt('departure', arrival)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q
    return data?.length > 0 ? data[0] : false
  }

  // ── Speichern ─────────────────────────────────────────────────────────────
  const save = async (form) => {
    // 1. Doppelbuchungsprüfung
    const conflict = await checkDoubleBooking(form.site_id, form.arrival, form.departure, form.id)
    if (conflict) {
      toast$(`⛔ Doppelbuchung: Platz bereits belegt durch ${conflict.guest_name} (${fmtDate(conflict.arrival)}–${fmtDate(conflict.departure)})`)
      return
    }

    // 2. Gast verknüpfen
    let guest_id = form.guest_id || null
    if (!form.id || !guest_id) guest_id = await resolveGuest(form.guest_name, form.email)

    const isNew = !form.id
    const payload = { ...form, campground_id: campground.id, guest_id }

    let error, savedBooking
    if (form.id) {
      const { id: _id, campground_id: _cid, created_at: _cat, booking_number: _bn, ...rest } = payload
      const res = await supabase.from('bookings').update(rest).eq('id', form.id).select().single()
      error = res.error; savedBooking = res.data
      if (!error) toast$('✓ Buchung gespeichert')
    } else {
      const { id: _id, ...rest } = payload
      const res = await supabase.from('bookings').insert(rest).select().single()
      error = res.error; savedBooking = res.data
    }
    if (error) { toast$('⛔ Fehler: ' + error.message); return }

    // 3. Stellplatz-Status auf 'occupied' setzen (nur bei aktiven Buchungen)
    if (form.site_id && !['cancelled', 'departed'].includes(form.status)) {
      await supabase.from('sites').update({ status: 'occupied' }).eq('id', form.site_id)
    }
    // Wenn storniert/abgereist → Platz freigeben (wenn keine anderen Buchungen)
    if (form.site_id && ['cancelled', 'departed'].includes(form.status)) {
      const { data: others } = await supabase.from('bookings')
        .select('id').eq('site_id', form.site_id)
        .not('status', 'in', '("cancelled","departed")')
        .neq('id', form.id || 'x').limit(1)
      if (!others?.length) await supabase.from('sites').update({ status: 'free' }).eq('id', form.site_id)
    }

    // 4. Bei neuer Buchung: automatisch eine Rechnung anlegen
    if (isNew && savedBooking) {
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14)
      await supabase.from('invoices').insert({
        campground_id: campground.id,
        booking_id:    savedBooking.id,
        guest_id:      guest_id || null,
        invoice_number: 0,
        type:          'Rechnung',
        amount:        savedBooking.total || 0,
        issued_date:   new Date().toISOString().slice(0, 10),
        due_date:      dueDate.toISOString().slice(0, 10),
      })
      toast$(`✓ Buchung angelegt · Rechnung erstellt · Gast ${guest_id ? 'verknüpft' : 'angelegt'}`)
    }

    setShowForm(false); setEditing(null)
    await load()
  }

  const del = async (id) => {
    if (!confirm('Buchung wirklich löschen?')) return
    // Hole site_id vor dem Löschen
    const booking = bookings.find(b => b.id === id)
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) { toast$('⛔ Fehler: ' + error.message); return }
    // Platz freigeben falls keine weiteren Buchungen
    if (booking?.site_id) {
      const { data: others } = await supabase.from('bookings')
        .select('id').eq('site_id', booking.site_id)
        .not('status', 'in', '("cancelled","departed")').limit(1)
      if (!others?.length) await supabase.from('sites').update({ status: 'free' }).eq('id', booking.site_id)
    }
    navigate('/buchungen')
    toast$('Buchung gelöscht')
    await load()
  }

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase()
    const matchQ = !q || b.guest_name.toLowerCase().includes(q) || b.site_name.toLowerCase().includes(q) || (b.email || '').toLowerCase().includes(q)
    const matchS = statusF === 'all' || b.status === statusF
    return matchQ && matchS
  }), [bookings, search, statusF])

  const detail = detailId ? bookings.find(b => b.id === detailId) : null

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  if (detail) return (
    <>
      <BookingDetail
        booking={detail}
        campground={campground}
        onEdit={() => setEditing(detail)}
        onDelete={() => del(detail.id)}
        onClose={() => navigate('/buchungen')}
      />
      {editing && (
        <BookingForm
          initial={editing}
          sites={sites}
          priceLists={priceLists}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      <Toast msg={toast} />
    </>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Buchungen</div>
          <div className="page-subtitle">{filtered.length} Buchung{filtered.length !== 1 ? 'en' : ''}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Neue Buchung
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Gast, Platz, E-Mail suchen…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-sel" value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="all">Alle Status</option>
            {Object.entries(STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>

        {filtered.length === 0
          ? <div className="empty-state"><Icon name="bookings" /><p>Keine Buchungen gefunden</p><small>Lege jetzt eine neue Buchung an.</small></div>
          : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nr.</th><th>Gast</th><th>Stellplatz</th><th>Anreise</th><th>Abreise</th>
                    <th>Nächte</th><th>Pers.</th><th>Status</th><th>Zahlung</th>
                    <th>Betrag</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} onClick={() => navigate('/buchungen/' + b.id)}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                          #{b.booking_number || '–'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={b.guest_name} size={30} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{b.guest_name}</div>
                            {b.email && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{b.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{b.site_name}</span>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{b.type}</div>
                      </td>
                      <td>{fmtDate(b.arrival)}</td>
                      <td>{fmtDate(b.departure)}</td>
                      <td>{nights(b.arrival, b.departure)}</td>
                      <td>{b.persons}</td>
                      <td><span className={`badge ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label}</span></td>
                      <td><span className={`badge ${PAYMENT[b.payment]?.cls}`}>{PAYMENT[b.payment]?.label}</span></td>
                      <td style={{ fontWeight: 600 }}>{fmt(b.total)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(b); setShowForm(false) }}>
                            <Icon name="edit" size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(b.id)}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {(showForm || editing) && (
        <BookingForm
          initial={editing}
          sites={sites}
          priceLists={priceLists}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
      <Toast msg={toast} />
    </div>
  )
}
