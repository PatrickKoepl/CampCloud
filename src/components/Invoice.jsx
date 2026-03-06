import { useRef } from 'react'
import { Icon, Modal } from './ui'
import { fmtDate, nights } from '../lib/utils'

// Alle Gebühren aus den Preislisten für diese Buchung
const SONSTIGES = [
  { name: 'Waschmaschinen Jeton',  price: 4.50 },
  { name: 'Frühstück pro Person',  price: 14.50 },
  { name: 'Frühstück pro Kind',    price: 7.50 },
  { name: 'Müllgebühr (pro Nacht)', price: 1.00 },
]

function printInvoice(id) {
  const el = document.getElementById(id)
  if (!el) return
  const w = window.open('', '_blank', 'width=800,height=1000')
  w.document.write(`
    <html>
    <head>
      <title>Rechnung</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px; }
        .inv { max-width: 720px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .logo { font-size: 22px; font-weight: 800; color: #1B4332; }
        .logo span { color: #2D6A4F; }
        .from { font-size: 12px; line-height: 1.7; color: #555; }
        .to-box { background: #F9FAFB; border-radius: 6px; padding: 14px 18px; margin-bottom: 30px; }
        .to-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #888; margin-bottom: 6px; }
        .to-name { font-size: 15px; font-weight: 600; }
        .meta { display: flex; gap: 40px; margin-bottom: 30px; }
        .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #888; display: block; margin-bottom: 3px; }
        .meta-item span { font-size: 13px; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #1B4332; color: #fff; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
        td { padding: 9px 12px; border-bottom: 1px solid #F0F0F0; font-size: 12.5px; }
        tr:last-child td { border-bottom: none; }
        .total-box { text-align: right; margin-bottom: 30px; }
        .total-box table { width: 280px; margin-left: auto; }
        .total-box td { padding: 5px 12px; border: none; }
        .total-row td { font-size: 16px; font-weight: 700; color: #1B4332; border-top: 2px solid #1B4332; padding-top: 10px; }
        .footer { border-top: 1px solid #eee; padding-top: 18px; font-size: 11px; color: #888; text-align: center; line-height: 1.7; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .badge-paid { background: #D1FAE5; color: #065F46; }
        .badge-pending { background: #FEF3C7; color: #92400E; }
        .badge-partial { background: #DBEAFE; color: #1E40AF; }
      </style>
    </head>
    <body>
      ${el.innerHTML}
    </body>
    </html>
  `)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 400)
}

export default function InvoiceModal({ booking, campground, lineItems, invoiceNumber, onClose }) {
  const invNum     = invoiceNumber ? `RE-${String(invoiceNumber).padStart(4, '0')}` : 'RE-' + booking.id.slice(0, 8).toUpperCase()
  const nightCount = nights(booking.arrival, booking.departure)
  const today      = new Date().toLocaleDateString('de-DE')
  const dueDate    = new Date(Date.now() + 14 * 86400000).toLocaleDateString('de-DE')

  // Zeilen entweder aus lineItems-Prop oder eine Fallback-Zeile
  const rows = lineItems && lineItems.length > 0
    ? lineItems
    : [{ label: `${booking.type || 'Stellplatz'} – Platz ${booking.site_name}`, detail: `${nightCount} Nächte, ${booking.persons} Person(en)`, amount: Number(booking.total) }]

  const subtotal  = rows.reduce((s, r) => s + r.amount, 0)
  const mwst      = subtotal / 1.07 * 0.07
  const netto     = subtotal - mwst
  const fmtE      = (v) => Number(v).toFixed(2).replace('.', ',') + ' €'

  const payBadge = booking.payment === 'paid'
    ? '<span class="badge badge-paid">Bezahlt</span>'
    : booking.payment === 'partial'
    ? '<span class="badge badge-partial">Teilzahlung</span>'
    : '<span class="badge badge-pending">Offen</span>'

  const rowsHTML = rows.map(r => `
    <tr>
      <td>${r.label}${r.detail ? `<br/><span style="color:#888;font-size:11px">${r.detail}</span>` : ''}</td>
      <td style="text-align:right;font-weight:600">${fmtE(r.amount)}</td>
    </tr>
  `).join('')

  const invoiceHTML = `
    <div class="inv">
      <div class="header">
        <div>
          <div class="logo">⛺ Camp<span>Cloud</span></div>
          <div class="from" style="margin-top:8px">
            ${campground?.name || ''}<br/>
            ${campground?.address || ''}<br/>
            ${campground?.phone || ''}<br/>
            ${campground?.email || ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:800;color:#1B4332;margin-bottom:6px">RECHNUNG</div>
          <div style="font-size:12px;color:#555;line-height:1.8">
            Nr.: <strong>${invNum}</strong><br/>
            Datum: ${today}<br/>
            Fällig: ${dueDate}<br/>
            ${payBadge}
          </div>
        </div>
      </div>

      <div class="to-box">
        <div class="to-label">Rechnungsempfänger</div>
        <div class="to-name">${booking.guest_name}</div>
        ${booking.email ? `<div style="font-size:12px;color:#555;margin-top:3px">${booking.email}</div>` : ''}
      </div>

      <div class="meta">
        <div class="meta-item"><label>Stellplatz</label><span>${booking.site_name}</span></div>
        <div class="meta-item"><label>Typ</label><span>${booking.type}</span></div>
        <div class="meta-item"><label>Anreise</label><span>${fmtDate(booking.arrival)}</span></div>
        <div class="meta-item"><label>Abreise</label><span>${fmtDate(booking.departure)}</span></div>
        <div class="meta-item"><label>Nächte</label><span>${nightCount}</span></div>
        <div class="meta-item"><label>Personen</label><span>${booking.persons}</span></div>
      </div>

      <table>
        <thead>
          <tr><th>Position</th><th style="text-align:right">Betrag</th></tr>
        </thead>
        <tbody>
          ${rowsHTML}
          ${booking.notes ? `<tr><td colspan="2" style="color:#888;font-size:11.5px;font-style:italic">Hinweis: ${booking.notes}</td></tr>` : ''}
        </tbody>
      </table>

      <div class="total-box">
        <table>
          <tr><td>Nettobetrag</td><td style="text-align:right">${fmtE(netto)}</td></tr>
          <tr><td>MwSt. 7%</td><td style="text-align:right">${fmtE(mwst)}</td></tr>
          <tr class="total-row"><td><strong>Gesamt</strong></td><td style="text-align:right"><strong>${fmtE(subtotal)}</strong></td></tr>
        </table>
      </div>

      <div class="footer">
        ${campground?.name || ''} · ${campground?.address || ''} · ${campground?.phone || ''} · ${campground?.email || ''}<br/>
        Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf unser Konto oder bezahlen Sie direkt vor Ort.
      </div>
    </div>
  `

  const mailtoSubject = encodeURIComponent(`Rechnung ${invNum} – ${campground?.name || 'Campingplatz'}`)
  const mailtoBody = encodeURIComponent(
    `Sehr geehrte/r ${booking.guest_name},\n\n` +
    `vielen Dank für Ihren Aufenthalt!\n\nRechnungsnummer: ${invNum}\n` +
    `Zeitraum: ${fmtDate(booking.arrival)} – ${fmtDate(booking.departure)} (${nightCount} Nächte)\n` +
    `Stellplatz: ${booking.site_name}\nGesamtbetrag: ${fmtE(subtotal)}\n\n` +
    `Mit freundlichen Grüßen\n${campground?.name || ''}\n${campground?.phone || ''}\n${campground?.email || ''}`
  )
  const mailtoHref = `mailto:${booking.email || ''}?subject=${mailtoSubject}&body=${mailtoBody}`

  return (
    <Modal title={`Rechnung ${invNum}`} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        {booking.email && (
          <a className="btn btn-secondary" href={mailtoHref}>
            <Icon name="mail" size={14} /> Per E-Mail senden
          </a>
        )}
        <button className="btn btn-primary" onClick={() => printInvoice('invoice-print-area')}>
          <Icon name="invoice" size={14} /> Drucken / Als PDF
        </button>
      </>}
    >
      <div id="invoice-print-area" style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: invoiceHTML }} />

      {/* ── Vorschau ── */}
      <div style={{ background: '#FAFAFA', border: '1px solid var(--border)', borderRadius: 8, padding: '28px 32px', fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.6 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1B4332' }}>⛺ Camp<span style={{ color: '#2D6A4F' }}>Cloud</span></div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 6, lineHeight: 1.8 }}>
              {campground?.name}<br />{campground?.address}<br />{campground?.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1B4332', marginBottom: 6 }}>RECHNUNG</div>
            <div style={{ fontSize: 12, color: '#777', lineHeight: 1.9 }}>
              Nr.: <strong>{invNum}</strong><br />
              Datum: {today}<br />
              Fällig bis: {dueDate}
            </div>
          </div>
        </div>

        {/* Empfänger */}
        <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '12px 16px', marginBottom: 22 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: '#888', marginBottom: 4 }}>Rechnungsempfänger</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{booking.guest_name}</div>
          {booking.email && <div style={{ fontSize: 12, color: '#555' }}>{booking.email}</div>}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
          {[['Stellplatz', booking.site_name], ['Typ', booking.type],
            ['Anreise', fmtDate(booking.arrival)], ['Abreise', fmtDate(booking.departure)],
            ['Nächte', nightCount], ['Personen', booking.persons]
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', marginBottom: 2 }}>{l}</div>
              <div style={{ fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── Positionstabelle ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#1B4332', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase' }}>Position</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', width: 110 }}>Betrag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 500 }}>{r.label}</div>
                  {r.detail && <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{r.detail}</div>}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {fmtE(r.amount)}
                </td>
              </tr>
            ))}
            {booking.notes && (
              <tr>
                <td colSpan={2} style={{ padding: '8px 12px', color: '#888', fontSize: 11.5, fontStyle: 'italic' }}>
                  Hinweis: {booking.notes}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Summe */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <div style={{ width: 260 }}>
            {[['Nettobetrag', fmtE(netto)], ['MwSt. 7%', fmtE(mwst)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#555' }}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', borderTop: '2px solid #1B4332', fontWeight: 700, fontSize: 16, color: '#1B4332' }}>
              <span>Gesamt</span>
              <span>{fmtE(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 14, fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.8 }}>
          {campground?.name} · {campground?.address}<br />
          Bitte überweisen Sie den Betrag innerhalb von 14 Tagen. Vielen Dank für Ihren Aufenthalt!
        </div>
      </div>
    </Modal>
  )
}

// ─── Mahnungs-Modal ────────────────────────────────────────────────────────────
export function DunningModal({ booking, campground, onClose }) {
  const daysSince = Math.floor((Date.now() - new Date(booking.created_at)) / 86400000)
  const invoiceNum = 'RE-' + booking.id.slice(0, 8).toUpperCase()

  const mailtoSubject = encodeURIComponent(`Zahlungserinnerung – ${invoiceNum} – ${campground?.name || ''}`)
  const mailtoBody = encodeURIComponent(
    `Sehr geehrte/r ${booking.guest_name},\n\n` +
    `wir möchten Sie freundlich daran erinnern, dass die Zahlung für Ihren Aufenthalt bei uns noch aussteht.\n\n` +
    `Rechnungsnummer: ${invoiceNum}\n` +
    `Aufenthalt: ${fmtDate(booking.arrival)} – ${fmtDate(booking.departure)}\n` +
    `Stellplatz: ${booking.site_name}\n` +
    `Offener Betrag: ${Number(booking.total).toFixed(2).replace('.', ',')} €\n\n` +
    `Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf unser Konto.\n\n` +
    `Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n` +
    `Mit freundlichen Grüßen\n${campground?.name || ''}\n${campground?.phone || ''}\n${campground?.email || ''}`
  )
  const mailtoHref = `mailto:${booking.email || ''}?subject=${mailtoSubject}&body=${mailtoBody}`

  return (
    <Modal title="Zahlungserinnerung senden" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        {booking.email
          ? <a className="btn btn-primary" href={mailtoHref} onClick={onClose}><Icon name="mail" size={14} /> E-Mail öffnen</a>
          : <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>Keine E-Mail hinterlegt</span>
        }
      </>}
    >
      <div style={{ padding: '4px 0' }}>
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, color: '#92400E', marginBottom: 4 }}>⚠️ Zahlung seit {daysSince} Tagen offen</div>
          <div style={{ fontSize: 13, color: '#92400E' }}>
            {booking.guest_name} · {Number(booking.total).toFixed(2).replace('.', ',')} € · Platz {booking.site_name}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Folgende Mahnung wird als Vorlage in deinem E-Mail-Programm geöffnet:
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 280, overflowY: 'auto' }}>
{`Sehr geehrte/r ${booking.guest_name},

wir möchten Sie freundlich daran erinnern, dass
die Zahlung für Ihren Aufenthalt noch aussteht.

Rechnungsnummer: ${invoiceNum}
Aufenthalt: ${fmtDate(booking.arrival)} – ${fmtDate(booking.departure)}
Stellplatz: ${booking.site_name}
Offener Betrag: ${Number(booking.total).toFixed(2).replace('.', ',')} €

Bitte überweisen Sie den Betrag innerhalb von
7 Tagen auf unser Konto.

Mit freundlichen Grüßen
${campground?.name || ''}`}
        </div>
      </div>
    </Modal>
  )
}

// ─── Geburtstags-Mail-Modal ────────────────────────────────────────────────────
export function BirthdayMailModal({ guest, campground, onClose }) {
  const mailtoSubject = encodeURIComponent(`Herzlichen Glückwunsch zum Geburtstag! 🎂`)
  const mailtoBody = encodeURIComponent(
    `Liebe/r ${guest.name},\n\n` +
    `das gesamte Team von ${campground?.name || 'unserem Campingplatz'} wünscht Ihnen herzlich alles Gute zum Geburtstag! 🎉🎂\n\n` +
    `Wir freuen uns, Sie bald wieder bei uns begrüßen zu dürfen.\n\n` +
    `Als kleines Geburtstagsgeschenk erhalten Sie bei Ihrem nächsten Aufenthalt eine Freude von uns – sprechen Sie uns einfach an!\n\n` +
    `Mit herzlichen Grüßen\n${campground?.name || ''}\n${campground?.phone || ''}`
  )
  const mailtoHref = `mailto:${guest.email || ''}?subject=${mailtoSubject}&body=${mailtoBody}`

  return (
    <Modal title="🎂 Geburtstagsmail senden" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        {guest.email
          ? <a className="btn btn-primary" href={mailtoHref} onClick={onClose}><Icon name="mail" size={14} /> E-Mail öffnen</a>
          : <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>Keine E-Mail hinterlegt</span>
        }
      </>}
    >
      <div style={{ padding: '4px 0' }}>
        <div style={{ background: '#FCE7F3', border: '1px solid #F9A8D4', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, color: '#9D174D', marginBottom: 4 }}>🎂 Geburtstag heute!</div>
          <div style={{ fontSize: 13, color: '#9D174D' }}>{guest.name}{guest.email ? ` · ${guest.email}` : ' · keine E-Mail hinterlegt'}</div>
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 260, overflowY: 'auto' }}>
{`Liebe/r ${guest.name},

das gesamte Team von ${campground?.name || 'unserem Campingplatz'} 
wünscht Ihnen herzlich alles Gute zum Geburtstag! 🎉🎂

Wir freuen uns, Sie bald wieder bei uns begrüßen 
zu dürfen.

Mit herzlichen Grüßen
${campground?.name || ''}`}
        </div>
      </div>
    </Modal>
  )
}
