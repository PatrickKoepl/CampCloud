import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon, Modal, Toast, AlertModal, ConfirmModal } from '../components/ui'
import { fmtDate, validateBirthDate } from '../lib/utils'

function GuestForm({ initial, onSave, onClose }) {
  const blank = { name: '', email: '', phone: '', address: '', birth_date: '', notes: '' }
  const normalize = (obj) => obj ? {
    ...blank, ...obj,
    email:      obj.email      ?? '',
    phone:      obj.phone      ?? '',
    address:    obj.address    ?? '',
    notes:      obj.notes      ?? '',
    birth_date: obj.birth_date ?? '',
  } : blank
  const [form, setForm] = useState(normalize(initial))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })) }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name ist erforderlich.'
    const bdErr = validateBirthDate(form.birth_date)
    if (bdErr) errs.birth_date = bdErr
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ungültige E-Mail-Adresse'
    return errs
  }

  const handle = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true); await onSave(form); setSaving(false)
  }

  // Maximales Geburtsdatum = heute (kein zukünftiges Datum)
  const todayStr = new Date().toISOString().slice(0, 10)
  const minBirth = new Date(); minBirth.setFullYear(minBirth.getFullYear() - 120)
  const minBirthStr = minBirth.toISOString().slice(0, 10)

  return (
    <Modal
      title={initial?.id ? 'Gast bearbeiten' : 'Neuer Gast'}
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
          <label className="form-label">Name <span className="req">*</span></label>
          <input
            className={`form-input ${errors.name ? 'input-error' : ''}`}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Max Mustermann"
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">E-Mail</label>
          <input
            className={`form-input ${errors.email ? 'input-error' : ''}`}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="max@email.de"
          />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Telefon</label>
          <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 151 …" />
        </div>
        <div className="form-group">
          <label className="form-label">Geburtsdatum</label>
          <input
            className={`form-input ${errors.birth_date ? 'input-error' : ''}`}
            type="date"
            value={form.birth_date}
            max={todayStr}
            min={minBirthStr}
            onChange={e => set('birth_date', e.target.value)}
          />
          {errors.birth_date && <div className="field-error">{errors.birth_date}</div>}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Adresse</label>
        <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Musterstraße 1, 12345 Musterstadt" />
      </div>
      <div className="form-group">
        <label className="form-label">Notizen</label>
        <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Besonderheiten, Präferenzen…" />
      </div>
    </Modal>
  )
}

export default function Guests() {
  const { campground } = useAuth()
  const [guests, setGuests]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast]     = useState('')
  const [errorModal, setErrorModal] = useState(null)   // { title, message, detail }
  const [confirmDel, setConfirmDel] = useState(null)   // guest object
  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }

  // BUG FIX: useCallback for stable reference
  const load = useCallback(async () => {
    if (!campground) return
    const { data, error } = await supabase.from('guests').select('*').eq('campground_id', campground.id).order('name')
    if (error) { console.error('Gäste laden fehlgeschlagen:', error.message); return }
    setGuests(data || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  const save = async (form) => {
    // BUG FIX: normalize null → '' for text fields so controlled inputs don't
    // switch between controlled/uncontrolled when DB returns null
    const payload = {
      ...form,
      campground_id: campground.id,
      notes:   form.notes   || null,  // store null not empty string
      phone:   form.phone   || null,
      email:   form.email   || null,
      address: form.address || null,
    }
    if (!payload.birth_date) payload.birth_date = null
    let error
    if (form.id) {
      const { id: _id, campground_id: _cid, created_at: _cat, visits: _v, last_visit: _lv, ...rest } = payload
      ;({ error } = await supabase.from('guests').update(rest).eq('id', form.id))
      if (!error) toast$('Gast gespeichert')
    } else {
      const { id: _id, ...rest } = payload
      ;({ error } = await supabase.from('guests').insert({
        ...rest,
        visits:     0,
        last_visit: new Date().toISOString().slice(0, 10),
      }))
      if (!error) toast$('Gast angelegt')
    }
    if (error) { toast$('Fehler: ' + error.message); return }
    setShowForm(false); setEditing(null)
    await load()
  }

  const del = async (id) => {
    // Prüfen ob Buchungen für diesen Gast existieren
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, booking_number, site_name, arrival, departure')
      .eq('guest_id', id)
      .limit(5)
    if (bErr) { toast$('⛔ Fehler beim Prüfen: ' + bErr.message); return }

    if (bookings && bookings.length > 0) {
      const list = bookings.map(b =>
        `• Buchung #${b.booking_number}: ${b.site_name}, ${fmtDate(b.arrival)} – ${fmtDate(b.departure)}`
      ).join('\n')
      setErrorModal({
        title: 'Gast kann nicht gelöscht werden',
        message: `Dieser Gast hat noch ${bookings.length} verknüpfte Buchung${bookings.length > 1 ? 'en' : ''} (und zugehörige Rechnungen). Bitte lösche zuerst alle Buchungen dieses Gastes, bevor du ihn entfernst.`,
        detail: list,
      })
      return
    }

    // Keine Buchungen → Bestätigungs-Dialog
    setConfirmDel(guests.find(g => g.id === id))
  }

  const doDelete = async (id) => {
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (error) { toast$('⛔ Fehler: ' + error.message); return }
    toast$('Gast gelöscht')
    await load()
  }

  const filtered = useMemo(() => guests.filter(g => {
    const q = search.toLowerCase()
    return !q || g.name.toLowerCase().includes(q) || (g.email || '').toLowerCase().includes(q) || (g.phone || '').includes(q)
  }), [guests, search])

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Gäste</div>
          <div className="page-subtitle">{filtered.length} Gast / Gäste</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Neuer Gast
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Name, E-Mail, Telefon suchen…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0
          ? <div className="empty-state"><Icon name="guests" /><p>Keine Gäste gefunden</p><small>Lege deinen ersten Gast an.</small></div>
          : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Nr.</th><th>Name</th><th>E-Mail</th><th>Telefon</th><th>Adresse</th><th>Besuche</th><th>Letzter Besuch</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id} onClick={() => setEditing(g)}>
                      <td>
                        <span className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          #{g.customer_number || '–'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={g.name} size={30} />
                          <span style={{ fontWeight: 500 }}>{g.name}</span>
                        </div>
                      </td>
                      <td>{g.email || <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                      <td>{g.phone || <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{g.address || <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                      <td><span className="badge badge-blue">{g.visits || 0}×</span></td>
                      <td>{g.last_visit ? fmtDate(g.last_visit) : '–'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(g)}><Icon name="edit" size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(g.id)}><Icon name="trash" size={13} /></button>
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
        <GuestForm initial={editing} onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />
      )}

      {errorModal && (
        <AlertModal
          type="error"
          title={errorModal.title}
          message={errorModal.message}
          detail={errorModal.detail}
          onClose={() => setErrorModal(null)}
        />
      )}

      {confirmDel && (
        <ConfirmModal
          title="Gast löschen?"
          message={`Soll „${confirmDel.name}" wirklich dauerhaft gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Ja, löschen"
          onConfirm={() => doDelete(confirmDel.id)}
          onClose={() => setConfirmDel(null)}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}
