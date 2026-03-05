import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon, Modal, Toast } from '../components/ui'
import { fmtDate } from '../lib/utils'

function GuestForm({ initial, onSave, onClose }) {
  // BUG FIX: null fields from DB would make controlled inputs uncontrolled.
  // Always normalize null → '' for text inputs.
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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handle = async () => {
    if (!form.name) { alert('Name ist erforderlich.'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }

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
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Max Mustermann" />
        </div>
        <div className="form-group">
          <label className="form-label">E-Mail</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="max@email.de" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Telefon</label>
          <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 151 …" />
        </div>
        <div className="form-group">
          <label className="form-label">Geburtsdatum</label>
          <input className="form-input" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
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
    if (!confirm('Gast wirklich löschen?')) return
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (error) { toast$('Fehler: ' + error.message); return }
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
                  <tr><th>Name</th><th>E-Mail</th><th>Telefon</th><th>Adresse</th><th>Besuche</th><th>Letzter Besuch</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id} onClick={() => setEditing(g)}>
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
      <Toast msg={toast} />
    </div>
  )
}
