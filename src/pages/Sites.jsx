import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Icon, Modal, Toast } from '../components/ui'

function SiteForm({ initial, onSave, onClose }) {
  const blank = { name: '', area: 'A', type: 'Stellplatz', size: '', electric: true, water: true, status: 'free', notes: '' }
  const [form, setForm] = useState(initial || blank)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handle = async () => { setSaving(true); await onSave(form); setSaving(false) }

  return (
    <Modal
      title={initial?.id ? 'Stellplatz bearbeiten' : 'Neuer Stellplatz'}
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
          <label className="form-label">Bezeichnung <span className="req">*</span></label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. A-01" />
        </div>
        <div className="form-group">
          <label className="form-label">Bereich</label>
          <input className="form-input" value={form.area} onChange={e => set('area', e.target.value)} placeholder="A" maxLength={5} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Typ</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option>Stellplatz</option><option>Mietunterkunft</option><option>Dauercamping</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Größe</label>
          <input className="form-input" value={form.size} onChange={e => set('size', e.target.value)} placeholder="z.B. 80 m²" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Strom</label>
          <select className="form-select" value={form.electric ? 'ja' : 'nein'} onChange={e => set('electric', e.target.value === 'ja')}>
            <option value="ja">Ja</option><option value="nein">Nein</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Wasseranschluss</label>
          <select className="form-select" value={form.water ? 'ja' : 'nein'} onChange={e => set('water', e.target.value === 'ja')}>
            <option value="ja">Ja</option><option value="nein">Nein</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="free">Frei</option><option value="occupied">Belegt</option><option value="blocked">Gesperrt</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notizen</label>
        <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Besonderheiten dieses Stellplatzes…" />
      </div>
    </Modal>
  )
}

export default function Sites() {
  const { campground } = useAuth()
  const [sites, setSites]     = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('map')
  const [filter, setFilter]   = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast]     = useState('')
  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }

  useEffect(() => { if (campground) load() }, [campground]) // eslint-disable-line

  // BUG FIX: stable function reference with useCallback
  const load = useCallback(async () => {
    if (!campground) return
    const { data, error } = await supabase.from('sites').select('*').eq('campground_id', campground.id).order('area').order('name')
    if (error) { console.error('Stellplätze laden fehlgeschlagen:', error.message); return }
    setSites(data || [])
    setLoading(false)
  }, [campground])

  const save = async (form) => {
    if (!form.name) { alert('Bitte Name eingeben.'); return }
    const payload = { ...form, campground_id: campground.id }
    let error
    if (form.id) {
      const { id: _id, campground_id: _cid, created_at: _cat, ...rest } = payload
      ;({ error } = await supabase.from('sites').update(rest).eq('id', form.id))
      if (!error) toast$('Stellplatz gespeichert')
    } else {
      const { id: _id, ...rest } = payload
      ;({ error } = await supabase.from('sites').insert(rest))
      if (!error) toast$('Stellplatz angelegt')
    }
    if (error) { toast$('Fehler: ' + error.message); return }
    setShowForm(false); setEditing(null)
    await load()
  }

  const del = async (id) => {
    if (!confirm('Stellplatz wirklich löschen?')) return
    const { error } = await supabase.from('sites').delete().eq('id', id)
    if (error) { toast$('Fehler: ' + error.message); return }
    toast$('Stellplatz gelöscht')
    await load()
  }

  const quickStatus = async (site) => {
    const cycle = { free: 'occupied', occupied: 'blocked', blocked: 'free' }
    const { error } = await supabase.from('sites').update({ status: cycle[site.status] }).eq('id', site.id)
    if (!error) toast$('Status aktualisiert')
    await load()
  }

  const free     = sites.filter(s => s.status === 'free').length
  const occupied = sites.filter(s => s.status === 'occupied').length
  const blocked  = sites.filter(s => s.status === 'blocked').length
  const filtered = filter === 'all' ? sites : sites.filter(s => s.status === filter)
  const areas    = [...new Set(filtered.map(s => s.area))].sort()

  const statusCfg = {
    free:     { label: 'Frei',     cls: 'badge-green', color: 'var(--green-700)' },
    occupied: { label: 'Belegt',   cls: 'badge-amber', color: '#92400E' },
    blocked:  { label: 'Gesperrt', cls: 'badge-gray',  color: '#6B7280' },
  }

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Stellplätze</div>
          <div className="page-subtitle">{free} frei · {occupied} belegt · {blocked} gesperrt</div>
        </div>
        <div className="page-actions">
          <div className="tab-bar">
            <div className={`tab ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
              <Icon name="map" /> Karte
            </div>
            <div className={`tab ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <Icon name="list" /> Liste
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Neuer Stellplatz
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[['all', 'Alle', sites.length], ['free', 'Frei', free], ['occupied', 'Belegt', occupied], ['blocked', 'Gesperrt', blocked]].map(([v, l, c]) => (
          <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(v)}>
            {l} <span style={{ opacity: 0.7, marginLeft: 2 }}>({c})</span>
          </button>
        ))}
      </div>

      <div className="card">
        {viewMode === 'map' ? (
          <div className="sites-map">
            {areas.length === 0 && (
              <div className="empty-state"><Icon name="sites" /><p>Keine Stellplätze vorhanden</p><small>Lege jetzt deinen ersten Stellplatz an.</small></div>
            )}
            {areas.map(area => (
              <div key={area}>
                <div className="sites-area-title">Bereich {area}</div>
                <div className="sites-grid">
                  {filtered.filter(s => s.area === area).map(s => (
                    <div
                      key={s.id}
                      className={`site-card ${s.status}`}
                      title={`${s.name} — Klicken zum Status-Wechsel`}
                    >
                      <div className="site-number">{s.name.replace(/^[A-Za-z]+-?/, '')}</div>
                      <div className="site-type">{s.type}</div>
                      {s.size && <div className="site-type">{s.size}</div>}
                      <div className="site-status" style={{ color: statusCfg[s.status].color }}>
                        {s.status === 'free' ? '✓ ' : s.status === 'occupied' ? '● ' : '✗ '}
                        {statusCfg[s.status].label}
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => quickStatus(s)}
                          title="Status wechseln"
                          style={{ padding: '3px 6px', fontSize: 10, color: 'var(--text-muted)' }}
                        >↻</button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setEditing(s)}
                          style={{ padding: '3px 6px' }}
                        ><Icon name="edit" size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {areas.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                💡 Klicke ↻ um den Status zu wechseln (Frei → Belegt → Gesperrt)
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            {filtered.length === 0
              ? <div className="empty-state"><Icon name="sites" /><p>Keine Stellplätze gefunden</p></div>
              : (
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Bereich</th><th>Typ</th><th>Größe</th><th>Strom</th><th>Wasser</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => (
                      <tr key={s.id} onClick={() => setEditing(s)}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.area}</td>
                        <td>{s.type}</td>
                        <td>{s.size || '–'}</td>
                        <td>{s.electric ? <span className="badge badge-green">✓</span> : <span className="badge badge-gray">–</span>}</td>
                        <td>{s.water ? <span className="badge badge-blue">✓</span> : <span className="badge badge-gray">–</span>}</td>
                        <td><span className={`badge ${statusCfg[s.status].cls}`}>{statusCfg[s.status].label}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(s)}><Icon name="edit" size={13} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(s.id)}><Icon name="trash" size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}
      </div>

      {(showForm || editing) && (
        <SiteForm
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
      <Toast msg={toast} />
    </div>
  )
}
