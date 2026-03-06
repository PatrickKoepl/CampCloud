import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Icon, Modal, Toast } from '../components/ui'
import { fmt, fmtDate } from '../lib/utils'
import InvoiceModal, { DunningModal } from '../components/Invoice'

// ─── Neue Rechnung erstellen ──────────────────────────────────────────────────
function NewInvoiceForm({ bookings, guests, onSave, onClose }) {
  const [form, setForm] = useState({
    booking_id: '', guest_id: '', type: 'Rechnung',
    issued_date: new Date().toISOString().slice(0, 10),
    due_date: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })(),
    amount: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })) }

  const onBookingChange = (bookingId) => {
    const b = bookings.find(b => b.id === bookingId)
    setForm(f => ({
      ...f,
      booking_id: bookingId,
      guest_id:   b?.guest_id || f.guest_id,
      amount:     b?.total ?? f.amount,
    }))
  }

  const validate = () => {
    const errs = {}
    if (!form.type)        errs.type = 'Typ wählen'
    if (!form.issued_date) errs.issued_date = 'Ausstellungsdatum fehlt'
    if (form.amount === '' || Number(form.amount) < 0) errs.amount = 'Gültiger Betrag erforderlich'
    const a = new Date(form.issued_date), d = new Date(form.due_date)
    if (form.due_date && d < a) errs.due_date = 'Fälligkeitsdatum muss nach Ausstellungsdatum liegen'
    return errs
  }

  const handle = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    await onSave({ ...form, amount: Number(form.amount) })
    setSaving(false)
  }

  const selectedBooking = bookings.find(b => b.id === form.booking_id)

  return (
    <Modal
      title="Neue Rechnung erstellen"
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={handle} disabled={saving}>
          <Icon name="check" /> {saving ? 'Speichern…' : 'Erstellen'}
        </button>
      </>}
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Typ <span className="req">*</span></label>
          <select className={`form-select ${errors.type ? 'input-error' : ''}`}
            value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="Rechnung">Rechnung</option>
            <option value="Mahnung">Mahnung</option>
          </select>
          {errors.type && <div className="field-error">{errors.type}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Buchung verknüpfen</label>
          <select className="form-select" value={form.booking_id}
            onChange={e => onBookingChange(e.target.value)}>
            <option value="">Keine Buchung</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                #{b.booking_number || '–'} · {b.guest_name} · {b.site_name} · {fmt(b.total)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBooking && (
        <div style={{ background: 'var(--green-100)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 12, color: 'var(--green-900)' }}>
          📋 Buchung #{selectedBooking.booking_number}: {selectedBooking.guest_name} ·
          Platz {selectedBooking.site_name} · {fmtDate(selectedBooking.arrival)} – {fmtDate(selectedBooking.departure)}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Gast</label>
          <select className="form-select" value={form.guest_id}
            onChange={e => set('guest_id', e.target.value)}>
            <option value="">Kein Gast</option>
            {guests.map(g => (
              <option key={g.id} value={g.id}>
                #{g.customer_number || '–'} · {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Betrag (€) <span className="req">*</span></label>
          <input className={`form-input ${errors.amount ? 'input-error' : ''}`}
            type="number" min="0" step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0,00" />
          {errors.amount && <div className="field-error">{errors.amount}</div>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Ausstellungsdatum <span className="req">*</span></label>
          <input className={`form-input ${errors.issued_date ? 'input-error' : ''}`}
            type="date" value={form.issued_date}
            onChange={e => set('issued_date', e.target.value)} />
          {errors.issued_date && <div className="field-error">{errors.issued_date}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Fällig am</label>
          <input className={`form-input ${errors.due_date ? 'input-error' : ''}`}
            type="date" value={form.due_date}
            min={form.issued_date || undefined}
            onChange={e => set('due_date', e.target.value)} />
          {errors.due_date && <div className="field-error">{errors.due_date}</div>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Notizen</label>
        <textarea className="form-textarea" rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Interne Notizen…" />
      </div>
    </Modal>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function Invoices() {
  const { campground } = useAuth()
  const navigate = useNavigate()
  const [invoices, setInvoices]   = useState([])
  const [bookings, setBookings]   = useState([])
  const [guests, setGuests]       = useState([])
  const [sites, setSites]         = useState([])
  const [priceLists, setPriceLists] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showForm, setShowForm]   = useState(false)
  const [printInvoice, setPrintInvoice] = useState(null) // { booking, type, lineItems }
  const [toast, setToast]         = useState('')
  const toast$ = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }

  const load = useCallback(async () => {
    if (!campground) return
    const cid = campground.id
    const [
      { data: invData },
      { data: bkData },
      { data: gsData },
      { data: sData },
      { data: pData },
    ] = await Promise.all([
      supabase.from('invoices')
        .select(`*, booking:bookings(id, booking_number, guest_name, site_name, site_id, arrival, departure, total, email, persons, type, notes), guest:guests(id, customer_number, name, email)`)
        .eq('campground_id', cid)
        .order('invoice_number', { ascending: false }),
      supabase.from('bookings')
        .select('id, booking_number, guest_id, guest_name, site_name, arrival, departure, total')
        .eq('campground_id', cid)
        .order('booking_number', { ascending: false }),
      supabase.from('guests')
        .select('id, customer_number, name, email')
        .eq('campground_id', cid)
        .order('customer_number'),
      supabase.from('sites').select('*').eq('campground_id', cid),
      supabase.from('price_lists').select('*').eq('campground_id', cid).eq('active', true),
    ])
    setInvoices(invData || [])
    setBookings(bkData || [])
    setGuests(gsData || [])
    setSites(sData || [])
    setPriceLists(pData || [])
    setLoading(false)
  }, [campground])

  useEffect(() => { load() }, [load])

  // ── Kostenaufschlüsselung berechnen ──────────────────────────────────────────
  const buildLineItems = (booking) => {
    if (!booking) return null
    const n = Math.max(0, Math.round((new Date(booking.departure) - new Date(booking.arrival)) / 86400000))
    if (n === 0) return null

    const site = sites.find(s => s.id === booking.site_id || s.name === booking.site_name)
    const pl = priceLists.find(p => p.type === (site?.type || booking.type))
           || priceLists[0]

    if (!pl) return null // kein Preisblatt → Fallback auf Gesamtbetrag

    const items = []
    if (pl.base_price > 0) {
      items.push({ label: `Stellplatz ${booking.site_name}`, detail: `${n} Nächte × ${fmtAmt(pl.base_price)} €`, amount: pl.base_price * n })
    }
    if (pl.per_person > 0 && booking.persons > 0) {
      items.push({ label: 'Personengebühr', detail: `${booking.persons} Pers. × ${n} Nächte × ${fmtAmt(pl.per_person)} €`, amount: pl.per_person * booking.persons * n })
    }
    if (site?.electric && pl.electricity > 0) {
      items.push({ label: 'Stromgebühr', detail: `${n} Nächte × ${fmtAmt(pl.electricity)} €`, amount: pl.electricity * n })
    }
    // Wenn keine Einzelpositionen → Gesamtbetrag als eine Zeile
    if (items.length === 0) {
      items.push({ label: `${booking.type || 'Stellplatz'} – Platz ${booking.site_name}`, detail: `${n} Nächte`, amount: Number(booking.total) })
    }
    return items
  }

  const fmtAmt = (v) => Number(v).toFixed(2).replace('.', ',')

  const save = async (form) => {
    const { error } = await supabase.from('invoices').insert({
      campground_id: campground.id,
      booking_id:    form.booking_id   || null,
      guest_id:      form.guest_id     || null,
      invoice_number: 0,
      type:          form.type,
      amount:        form.amount,
      issued_date:   form.issued_date,
      due_date:      form.due_date     || null,
      notes:         form.notes        || null,
    })
    if (error) { toast$('⛔ Fehler: ' + error.message); return }
    toast$('Rechnung erstellt ✓')
    setShowForm(false)
    await load()
  }

  const del = async (id) => {
    if (!confirm('Rechnung wirklich löschen?')) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { toast$('⛔ Fehler: ' + error.message); return }
    toast$('Rechnung gelöscht')
    await load()
  }

  const markPaid = async (inv) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('invoices')
      .update({ paid_date: inv.paid_date ? null : today })
      .eq('id', inv.id)
    if (error) { toast$('⛔ ' + error.message); return }
    toast$(inv.paid_date ? 'Als offen markiert' : '✓ Zahlung eingegangen')
    await load()
  }

  const openPrint = (inv) => {
    if (!inv.booking) { toast$('⛔ Keine Buchung verknüpft'); return }
    const lineItems = buildLineItems(inv.booking)
    setPrintInvoice({ booking: inv.booking, type: inv.type, lineItems, invoiceNumber: inv.invoice_number })
  }

  const filtered = useMemo(() => invoices.filter(inv => {
    const q = search.toLowerCase()
    const guestName = inv.guest?.name || inv.booking?.guest_name || ''
    const matchQ = !q
      || guestName.toLowerCase().includes(q)
      || String(inv.invoice_number).includes(q)
      || String(inv.booking?.booking_number || '').includes(q)
    const matchT = typeFilter === 'all' || inv.type === typeFilter
    return matchQ && matchT
  }), [invoices, search, typeFilter])

  if (loading) return <div className="page" style={{ paddingTop: 60 }}><Spinner /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Rechnungen</div>
          <div className="page-subtitle">{filtered.length} Einträge</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Neue Rechnung
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Gast, Rechnungsnr., Buchungsnr. suchen…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Alle Typen</option>
            <option value="Rechnung">Rechnung</option>
            <option value="Mahnung">Mahnung</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <Icon name="invoice" />
            <p>Keine Rechnungen vorhanden</p>
            <small>Erstelle eine neue Rechnung aus einer Buchung.</small>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Rechnungsnr.</th>
                  <th>Typ</th>
                  <th>Buchungsnr.</th>
                  <th>Kundennr.</th>
                  <th>Gast</th>
                  <th>Betrag</th>
                  <th>Fällig</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const guestName = inv.guest?.name || inv.booking?.guest_name || '–'
                  const custNr    = inv.guest?.customer_number
                  const guestId   = inv.guest?.id
                  const bookNr    = inv.booking?.booking_number
                  const bookId    = inv.booking?.id
                  const isPaid    = !!inv.paid_date
                  const isOverdue = !isPaid && inv.due_date && new Date(inv.due_date) < new Date()

                  return (
                    <tr key={inv.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.issued_date)}</td>

                      {/* Rechnungsnr. → Klick öffnet Druckvorschau */}
                      <td>
                        {inv.booking ? (
                          <button
                            onClick={() => openPrint(inv)}
                            title="Rechnung öffnen / drucken"
                            style={{
                              fontWeight: 600, fontSize: 12, color: '#065F46',
                              background: '#D1FAE5', border: '1px solid #6EE7B7',
                              borderRadius: 6, padding: '3px 9px', cursor: 'pointer',
                            }}
                          >#{inv.invoice_number} ↗</button>
                        ) : (
                          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>#{inv.invoice_number}</span>
                        )}
                      </td>

                      <td>
                        <span className={`badge ${inv.type === 'Mahnung' ? 'badge-amber' : 'badge-blue'}`}>
                          {inv.type}
                        </span>
                      </td>

                      {/* Buchungsnr. → Klick springt zur Buchung */}
                      <td>
                        {bookNr && bookId ? (
                          <button
                            onClick={() => navigate('/buchungen/' + bookId)}
                            title="Zur Buchung springen"
                            style={{
                              fontWeight: 600, fontSize: 12, color: '#1D4ED8',
                              background: '#EFF6FF', border: '1px solid #BFDBFE',
                              borderRadius: 6, padding: '3px 9px', cursor: 'pointer',
                            }}
                          >
                            #{bookNr} ↗
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>

                      {/* Kundennr. → Klick springt zum Gast */}
                      <td>
                        {custNr && guestId ? (
                          <button
                            onClick={() => navigate('/gaeste')}
                            title="Zum Gast springen"
                            style={{
                              fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                              color: '#6B21A8', background: '#F5F3FF',
                              border: '1px solid #DDD6FE', borderRadius: 6,
                              padding: '3px 9px', cursor: 'pointer',
                            }}
                          >
                            #{custNr} ↗
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={guestName} size={28} />
                          <span style={{ fontWeight: 500 }}>{guestName}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(inv.amount)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: isOverdue ? 'var(--red)' : undefined }}>
                        {inv.due_date ? fmtDate(inv.due_date) : '–'}
                        {isOverdue && ' ⚠️'}
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="badge badge-green">✓ Bezahlt</span>
                        ) : isOverdue ? (
                          <span className="badge badge-red">Überfällig</span>
                        ) : (
                          <span className="badge badge-amber">Offen</span>
                        )}
                      </td>

                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {/* Drucken */}
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Rechnung drucken / PDF"
                            onClick={() => openPrint(inv)}
                            disabled={!inv.booking}
                          >
                            <Icon name="invoice" size={13} />
                          </button>

                          {/* Zahlung eingegangen — grüner € Button */}
                          <button
                            title={isPaid ? 'Zahlung stornieren' : 'Zahlung eingegangen'}
                            onClick={() => markPaid(inv)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 6, border: 'none',
                              cursor: 'pointer', fontSize: 14, fontWeight: 700,
                              background: isPaid ? '#D1FAE5' : '#F3F4F6',
                              color:      isPaid ? '#065F46' : '#9CA3AF',
                              transition: 'all .15s',
                            }}
                          >
                            €
                          </button>

                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: 'var(--red)' }}
                            onClick={() => del(inv.id)}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <NewInvoiceForm
          bookings={bookings}
          guests={guests}
          onSave={save}
          onClose={() => setShowForm(false)}
        />
      )}

      {printInvoice && printInvoice.type === 'Rechnung' && (
        <InvoiceModal
          booking={printInvoice.booking}
          campground={campground}
          lineItems={printInvoice.lineItems}
          invoiceNumber={printInvoice.invoiceNumber}
          onClose={() => setPrintInvoice(null)}
        />
      )}
      {printInvoice && printInvoice.type === 'Mahnung' && (
        <DunningModal
          booking={printInvoice.booking}
          campground={campground}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}
