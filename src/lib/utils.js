export const fmt   = (n) => `${Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
export const nights  = (a, d) => a && d ? Math.max(1, Math.round((new Date(d) - new Date(a)) / 86400000)) : 0
export const todayISO = () => new Date().toISOString().slice(0, 10)

export const STATUS = {
  pending:   { label: 'Anfrage',   cls: 'badge-amber' },
  confirmed: { label: 'Bestätigt', cls: 'badge-blue'  },
  arrived:   { label: 'Angereist', cls: 'badge-green' },
  departed:  { label: 'Abgereist', cls: 'badge-gray'  },
  cancelled: { label: 'Storniert', cls: 'badge-red'   },
}

export const PAYMENT = {
  pending:  { label: 'Ausstehend',  cls: 'badge-amber' },
  paid:     { label: 'Bezahlt',     cls: 'badge-green' },
  partial:  { label: 'Teilzahlung', cls: 'badge-blue'  },
}
