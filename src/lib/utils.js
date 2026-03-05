// Datum-String 'YYYY-MM-DD' → lokales Date-Objekt (verhindert UTC-Timezone-Bug)
const parseDate = (d) => {
  if (!d) return null
  const [y, m, day] = String(d).split('-').map(Number)
  return new Date(y, m - 1, day)
}

export const fmt   = (n) => `${Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
export const fmtDate = (d) => {
  const dt = parseDate(d)
  return dt ? dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
}
export const nights = (a, d) => {
  if (!a || !d) return 0
  return Math.max(0, Math.round((parseDate(d) - parseDate(a)) / 86400000))
}
export const todayISO = () => new Date().toISOString().slice(0, 10)

// ─── Datumsvalidierung ────────────────────────────────────────────────────────
// Gibt null zurück wenn OK, sonst Fehlermeldung
export const validateBookingDates = (arrival, departure) => {
  if (!arrival)   return 'Bitte Anreisedatum angeben.'
  if (!departure) return 'Bitte Abreisedatum angeben.'

  const a = parseDate(arrival)
  const d = parseDate(departure)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const oneYearAgo  = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1)
  const twoYearsOut = new Date(today); twoYearsOut.setFullYear(today.getFullYear() + 2)

  if (a < oneYearAgo)   return 'Anreisedatum liegt mehr als 1 Jahr in der Vergangenheit.'
  if (a > twoYearsOut)  return 'Anreisedatum liegt mehr als 2 Jahre in der Zukunft.'
  if (d <= a)           return 'Abreise muss nach der Anreise liegen (mind. 1 Nacht).'
  if (d > twoYearsOut)  return 'Abreisedatum liegt mehr als 2 Jahre in der Zukunft.'

  const n = Math.round((d - a) / 86400000)
  if (n > 365) return `Aufenthaltsdauer von ${n} Nächten ist ungewöhnlich lang. Bitte prüfen.`

  return null
}

export const validateBirthDate = (birth_date) => {
  if (!birth_date) return null   // optional
  const b = parseDate(birth_date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const maxAge = new Date(today); maxAge.setFullYear(today.getFullYear() - 120)

  if (b >= today)  return 'Geburtsdatum muss in der Vergangenheit liegen.'
  if (b < maxAge)  return 'Geburtsdatum liegt mehr als 120 Jahre zurück.'
  return null
}

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
