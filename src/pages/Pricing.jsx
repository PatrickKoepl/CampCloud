import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Icon, Modal, Toast } from '../components/ui'
import { fmt } from '../lib/utils'

function PriceForm({ initial, onSave, onClose }) {
  const blank = { name: '', type: 'Stellplatz', base_price: 0, per_person: 0, electricity: 0, active: true }
  const [form, setForm] = useState(initial ? { ...blank, ...initial } : blank)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handle = async () => {
    if (!form.name) { alert('Name erforderlich.'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }

  return (
    <Modal
      title={initial?.id ? 'Preisliste bearbeiten' : 'Neue Preisliste'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={handle} disabled={saving}>
          <Icon name="check" /> {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </>}
    >
      <div className="form-group">
        <label className="form-label">Name <span className="req">*</span></label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Hochsaison 2026" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Typ</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option>Stellplatz</option><option>Mietunterkunft</option><option>Dauercamping</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Aktiv</label>
          <select className="form-select" value={form.active ? 'ja' : 'nein'} onChange={e => set('active', e.target.value === 'ja')}>
            <option value="ja">Ja</option><option value="nein">Nein</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Grundpreis / Nacht (€)</label>
          <input className="form-input" type="number" min="0" step="0.5" value={form.base_price} onChange={e => set('base_price', +e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Pro Person / Nacht (€)</label>
          <input className="form-input" type="number" min="0" step="0.5" value={form.per_person} onChange={e => set('per_person', +e.target.value)} />
          <div className="form-hint">0 = im Grundpreis enthalten</div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Strom / Nacht (€)</label>
          <input className="form-input" type="number" min="0" step="0.5" value={form.electricity} onChange={e => set('electricity', +e.target.value)} />
          <div className="form-hint">0 = inklusive</div>
        </div>
      </div>
    </Modal>
  )
}

const TYPE_BADGE = {
  'Stellplatz':    'badge-green',
  'Mietunterkunft':'badge-blue',
  'Dauercamping':  'badge-amber',
}

export default function Pricing() {
  const { campground } = useAuth()
  const [lists, setLists]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast]     = useState('')
  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }

  // BUG FIX: useCallback for stable reference
  const load = useCallback(async () => {
    if (!campground) return
    const { data, error } = await supabase.from('price_lists').select('*').eq('campground_id', campground.id).order('created_at')
    if (error) { console.error('Preislisten laden fehlgeschlagen:', error.message); return }
    setLists(data || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  const save = async (form) => {
    const payload = { ...form, campground_id: campground.id }
    let error
    if (form.id) {
      const { id: _id, campground_id: _cid, created_at: _cat, ...rest } = payload
      ;({ error } = await supabase.from('price_lists').update(rest).eq('id', form.id))
      if (!error) toast$('Preisliste gespeichert')
    } else {
      const { id: _id, ...rest } = payload
      ;({ error } = await supabase.from('price_lists').insert(rest))
      if (!error) toast$('Preisliste angelegt')
    }
    if (error) { toast$('Fehler: ' + error.message); return }
    setShowForm(false); setEditing(null)
    await load()
  }

  const del = async (id) => {
    if (!confirm('Preisliste löschen?')) return
    const { error } = await supabase.from('price_lists').delete().eq('id', id)
    if (error) { toast$('Fehler: ' + error.message); return }
    toast$('Preisliste gelöscht')
    await load()
  }

  const toggle = async (p) => {
    const { error } = await supabase.from('price_lists').update({ active: !p.active }).eq('id', p.id)
    if (!error) toast$(p.active ? 'Preisliste deaktiviert' : 'Preisliste aktiviert')
    await load()
  }

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Preislisten</div>
          <div className="page-subtitle">Konfiguriere Preise für jeden Stellplatztyp und jede Saison</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Neue Preisliste
          </button>
        </div>
      </div>

      {lists.length === 0
        ? (
          <div className="card">
            <div className="empty-state">
              <Icon name="pricing" />
              <p>Noch keine Preislisten vorhanden</p>
              <small>Lege deine erste Preisliste an.</small>
            </div>
          </div>
        )
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lists.map(p => (
              <div className="card" key={p.id}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div className="card-title">{p.name}</div>
                    <span className={`badge ${TYPE_BADGE[p.type] || 'badge-gray'}`}>{p.type}</span>
                    <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>{p.active ? 'Aktiv' : 'Inaktiv'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggle(p)}>
                      {p.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(p)}>
                      <Icon name="edit" />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {[
                    ['Grundpreis / Nacht', fmt(p.base_price)],
                    ['Pro Person / Nacht', p.per_person > 0 ? fmt(p.per_person) : 'Inklusive'],
                    ['Strom / Nacht', p.electricity > 0 ? fmt(p.electricity) : 'Inklusive'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>{l}</div>
                      <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--green-900)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {(showForm || editing) && (
        <PriceForm initial={editing} onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />
      )}
      <Toast msg={toast} />
    </div>
  )
}
