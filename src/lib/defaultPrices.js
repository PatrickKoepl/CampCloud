// Standardpreise für neue Campingplätze
// Wird in Pricing.jsx verwendet um beim ersten Laden Vorschläge anzuzeigen

export const DEFAULT_PRICES = [
  // Stellgebühren
  { name: 'Wohnwagen (inkl. PKW)',       type: 'Stellplatz',    base_price: 9.00,  per_person: 0,    electricity: 0,    active: true },
  { name: 'Wohnmobil bis 8,5 m',         type: 'Stellplatz',    base_price: 9.00,  per_person: 0,    electricity: 0,    active: true },
  { name: 'Wohnmobil bis 11 m',          type: 'Stellplatz',    base_price: 10.00, per_person: 0,    electricity: 0,    active: true },
  { name: 'Zelt + PKW',                  type: 'Stellplatz',    base_price: 7.50,  per_person: 0,    electricity: 0,    active: true },
  // Personengebühren
  { name: 'Erwachsene (pro Nacht)',       type: 'Stellplatz',    base_price: 0,     per_person: 9.00, electricity: 0,    active: true },
  { name: 'Kinder 4–15 Jahre',           type: 'Stellplatz',    base_price: 0,     per_person: 5.00, electricity: 0,    active: true },
  { name: 'Haustiere',                   type: 'Stellplatz',    base_price: 0,     per_person: 3.00, electricity: 0,    active: true },
  // Strom
  { name: 'Strompauschale Zelt/PKW',     type: 'Stellplatz',    base_price: 0,     per_person: 0,    electricity: 5.00, active: true },
  { name: 'Strompauschale WW/WM',        type: 'Stellplatz',    base_price: 0,     per_person: 0,    electricity: 3.50, active: true },
  // Sonstiges
  { name: 'Waschmaschinen Jeton',        type: 'Dauercamping',  base_price: 4.50,  per_person: 0,    electricity: 0,    active: true },
  { name: 'Frühstück pro Person',        type: 'Mietunterkunft',base_price: 14.50, per_person: 0,    electricity: 0,    active: true },
  { name: 'Frühstück pro Kind',          type: 'Mietunterkunft',base_price: 7.50,  per_person: 0,    electricity: 0,    active: true },
  { name: 'Müllgebühr (pro Nacht)',      type: 'Stellplatz',    base_price: 1.00,  per_person: 0,    electricity: 0,    active: true },
]
