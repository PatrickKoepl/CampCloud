import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon, Modal, Toast } from '../components/ui'
import { fmt, fmtDate, nights, STATUS, PAYMENT } from '../lib/utils'

// ─── Form ─────────────────────────────────────────────────────────────────────
function BookingForm({ initial, sites, onSave, onClose }) {
  const blank = { guest_name: '', email: '', site_name: '', type: 'Stellplatz', arrival: '', departure: '', persons: 2, status: 'confirmed', payment: 'pending', total: 0, notes: '' }
  const [form, setForm] = useState(initial || blank)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handle = async () => {
    if (!form.guest_name || !form.arrival || !form.departure || !form.site_name) {
      alert('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <Modal
      title={initial?.id ? 'Buchung bearbeiten' : 'Neue Buchung'}
      onClose={onClose}
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
          <input className="form-input" value={form.guest_name} onChange={e => set('guest_name', e.target.value)} placeholder="Max Mustermann" />
        </div>
        <div className="form-group">
          <label className="form-label">E-Mail</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="gast@email.de" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Stellplatz <span className="req">*</span></label>
          <select className="form-select" value={form.site_name} onChange={e => set('site_name', e.target.value)}>
            <option value="">Stellplatz wählen…</option>
            {sites.map(s => <option key={s.id} value={s.name}>{s.name} ({s.type})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Typ</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option>Stellplatz</option>
            <option>Mietunterkunft</option>
            <option>Dauercamping</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Anreise <span className="req">*</span></label>
          <input className="form-input" type="date" value={form.arrival} onChange={e => set('arrival', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Abreise <span className="req">*</span></label>
          <input className="form-input" type="date" value={form.departure} onChange={e => set('departure', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Personen</label>
          <input className="form-input" type="number" min="1" max="30" value={form.persons} onChange={e => set('persons', +e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Gesamtbetrag (€)</label>
          <input className="form-input" type="number" min="0" step="0.01" value={form.total} onChange={e => set('total', +e.target.value)} />
        </div>
      </div>
      <div className="form-row">
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
      <div className="form-group">
        <label className="form-label">Notizen</label>
        <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Interne Notizen zur Buchung…" />
      </div>
    </Modal>
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────
function BookingDetail({ booking, onEdit, onDelete, onClose }) {
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
            </div>
            <div style={{ background: 'var(--green-100)', border: '1px solid var(--green-200)', borderRadius: 10, padding: '18px 22px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Gesamtbetrag</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--green-900)' }}>
                {fmt(booking.total)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }}><Icon name="mail" /> E-Mail senden</button>
              <button className="btn btn-secondary" style={{ flex: 1 }}><Icon name="invoice" /> Rechnung</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Bookings() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const { id: detailId } = useParams()

  const [bookings, setBookings] = useState([])
  const [sites, setSites]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [toast, setToast]       = useState('')

  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }

  // BUG FIX: useCallback so load() is stable and doesn't re-create on every render
  const load = useCallback(async () => {
    if (!campground) return
    const [{ data: b, error: be }, { data: s }] = await Promise.all([
      supabase.from('bookings').select('*').eq('campground_id', campground.id).order('arrival', { ascending: false }),
      supabase.from('sites').select('*').eq('campground_id', campground.id).order('name'),
    ])
    if (be) { console.error('Buchungen laden fehlgeschlagen:', be.message); return }
    setBookings(b || [])
    setSites(s || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  // Gast automatisch anlegen oder verknüpfen
  const resolveGuest = async (guestName, email) => {
    if (!guestName) return null
    // Erst nach bestehendem Gast suchen (E-Mail oder Name)
    let existing = null
    if (email) {
      const { data } = await supabase.from('guests')
        .select('id, visits')
        .eq('campground_id', campground.id)
        .eq('email', email)
        .maybeSingle()
      existing = data
    }
    if (!existing) {
      const { data } = await supabase.from('guests')
        .select('id, visits')
        .eq('campground_id', campground.id)
        .ilike('name', guestName.trim())
        .maybeSingle()
      existing = data
    }

    if (existing) {
      // Besuchszähler erhöhen + letzten Besuch aktualisieren
      await supabase.from('guests').update({
        visits:     (existing.visits || 0) + 1,
        last_visit: new Date().toISOString().slice(0, 10),
        ...(email ? { email } : {}),
      }).eq('id', existing.id)
      return existing.id
    } else {
      // Neuen Gast anlegen
      const { data } = await supabase.from('guests').insert({
        campground_id: campground.id,
        name:       guestName.trim(),
        email:      email || null,
        visits:     1,
        last_visit: new Date().toISOString().slice(0, 10),
      }).select('id').single()
      return data?.id ?? null
    }
  }

  const save = async (form) => {
    // Gast automatisch verknüpfen (nur bei neuer Buchung oder wenn kein Gast gesetzt)
    let guest_id = form.guest_id || null
    if (!form.id || !guest_id) {
      guest_id = await resolveGuest(form.guest_name, form.email)
    }

    const payload = { ...form, campground_id: campground.id, guest_id }
    let error
    if (form.id) {
      const { id: _id, campground_id: _cid, created_at: _cat, ...rest } = payload
      ;({ error } = await supabase.from('bookings').update(rest).eq('id', form.id))
      if (!error) toast$('Buchung gespeichert')
    } else {
      const { id: _id, ...rest } = payload
      ;({ error } = await supabase.from('bookings').insert(rest))
      if (!error) toast$('Buchung angelegt — Gast automatisch ' + (guest_id ? 'verknüpft' : 'angelegt'))
    }
    if (error) { toast$('Fehler: ' + error.message); return }
    setShowForm(false); setEditing(null)
    await load()
  }

  const del = async (id) => {
    if (!confirm('Buchung wirklich löschen?')) return
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) { toast$('Fehler: ' + error.message); return }
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
        onEdit={() => {
          /*
           * BUG FIX: Previously this called navigate('/buchungen') which caused
           * React Router to match a different <Route> element and remount the
           * component → editing state was lost → form never opened.
           * Fix: set editing state here and show the form ON TOP of the detail
           * view without any navigation. The user saves/cancels from the modal.
           */
          setEditing(detail)
        }}
        onDelete={() => del(detail.id)}
        onClose={() => navigate('/buchungen')}
      />
      {editing && (
        <BookingForm
          initial={editing}
          sites={sites}
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
                    <th>Gast</th><th>Stellplatz</th><th>Anreise</th><th>Abreise</th>
                    <th>Nächte</th><th>Pers.</th><th>Status</th><th>Zahlung</th>
                    <th>Betrag</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} onClick={() => navigate('/buchungen/' + b.id)}>
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
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
      <Toast msg={toast} />
    </div>
  )
}
