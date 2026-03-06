import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Spinner } from './components/ui'
import { supabase } from './lib/supabase'

import Login        from './pages/Login'
import Layout       from './pages/Layout'
import Dashboard    from './pages/Dashboard'
import Bookings     from './pages/Bookings'
import Sites        from './pages/Sites'
import Guests       from './pages/Guests'
import Pricing      from './pages/Pricing'
import Settings     from './pages/Settings'
import Invoices     from './pages/Invoices'
import Timeline     from './pages/Timeline'

// ─── Protected app ────────────────────────────────────────────────────────────
function ProtectedApp() {
  const { user, campground, loading } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  // BUG FIX: filter by campground_id (previously unfiltered)
  const loadCount = useCallback(async () => {
    if (!campground) return
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('campground_id', campground.id)
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }, [campground])

  useEffect(() => {
    if (!user || !campground) return
    loadCount()

    // Realtime badge updates — scoped to this campground
    const channel = supabase
      .channel('bookings-badge-' + campground.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `campground_id=eq.${campground.id}`,
      }, loadCount)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, campground, loadCount])

  if (loading) return <Spinner fullPage />
  if (!user)   return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<Layout pendingCount={pendingCount} />}>
        <Route index                element={<Dashboard />} />
        {/*
          BUG FIX: /buchungen und /buchungen/:id als getrennte Routes würden
          die Komponente bei Navigation remounten → editing-State verloren →
          Edit-Formular öffnete sich nie. Beide Routes rendern dieselbe
          Komponente; React Router behält den State beim URL-Wechsel.
        */}
        <Route path="buchungen"     element={<Bookings />} />
        <Route path="buchungen/:id" element={<Bookings />} />
        <Route path="stellplaetze"  element={<Sites />} />
        <Route path="gaeste"        element={<Guests />} />
        <Route path="preislisten"   element={<Pricing />} />
        <Route path="rechnungen"    element={<Invoices />} />
        <Route path="zeitplan"      element={<Timeline />} />
        <Route path="einstellungen" element={<Settings />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner fullPage />
  if (user)    return <Navigate to="/" replace />
  return <Login />
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute />} />
        <Route path="/*"     element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  )
}
