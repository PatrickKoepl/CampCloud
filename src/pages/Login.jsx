import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/ui'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]       = useState('login')   // 'login' | 'register'
  const [form, setForm]       = useState({ email: '', password: '', campName: '' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError(''); setInfo('')
    if (!form.email || !form.password) { setError('Bitte E-Mail und Passwort eingeben.'); return }
    if (mode === 'register' && !form.campName) { setError('Bitte den Namen deines Campingplatzes eingeben.'); return }
    if (form.password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) setError('E-Mail oder Passwort falsch.')
      } else {
        const { error } = await signUp(form.email, form.password, form.campName)
        if (error) setError(error.message)
        else setInfo('Registrierung erfolgreich! Bitte E-Mail bestätigen, dann anmelden.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-logo">
          <span>⛺</span> Camp<span>Cloud</span>
        </div>
        <div className="login-tagline">
          Campingplatz-Verwaltung,<br />einfach in der Cloud.
        </div>
        <div className="login-sub">
          Die moderne All-in-One Software für Campingplatz-Betreiber.
          Kostenlos, Open Source, selbst gehostet.
        </div>
        <ul className="login-features">
          <li>Buchungen anlegen, verwalten & verfolgen</li>
          <li>Stellplatzplan mit Belegungsübersicht</li>
          <li>Gästeverwaltung & Stammkunden</li>
          <li>Flexible Preislisten pro Saison</li>
          <li>Anreise- & Abreise-Tracking</li>
          <li>Rechnungen & Mailing</li>
        </ul>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div className="login-form-title">
            {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
          </div>
          <div className="login-form-sub">
            {mode === 'login'
              ? 'Melde dich mit deinem Account an.'
              : 'Erstelle deinen kostenlosen Account.'}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {info  && <div className="alert alert-success">{info}</div>}

          <div className="form-group">
            <label className="form-label">E-Mail-Adresse</label>
            <input
              className="form-input"
              type="email"
              placeholder="deine@email.de"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Name des Campingplatzes</label>
              <input
                className="form-input"
                placeholder="z.B. Camping Waldblick"
                value={form.campName}
                onChange={e => set('campName', e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Passwort</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Mindestens 6 Zeichen"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ paddingRight: 42 }}
              />
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? 'Bitte warten…'
              : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>

          <div className="login-divider">oder</div>

          {mode === 'login' ? (
            <div style={{ textAlign: 'center', fontSize: 13.5 }}>
              Noch kein Account?{' '}
              <span className="login-link" onClick={() => { setMode('register'); setError(''); setInfo('') }}>
                Kostenlos registrieren
              </span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: 13.5 }}>
              Bereits ein Konto?{' '}
              <span className="login-link" onClick={() => { setMode('login'); setError(''); setInfo('') }}>
                Anmelden
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
