import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(undefined) // undefined = loading
  const [campground, setCampground]   = useState(null)
  const [loading, setLoading]         = useState(true)

  // Load session + campground
  useEffect(() => {
    /*
     * BUG FIX: Supabase's onAuthStateChange fires immediately with the current
     * session (INITIAL_SESSION event). Calling loadCampground in BOTH getSession
     * AND onAuthStateChange caused two parallel DB calls on every page load.
     * Fix: only use onAuthStateChange as the single source of truth.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadCampground(u.id)
      else { setCampground(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCampground = async (userId) => {
    // BUG FIX: handle error case (e.g. new user where trigger hasn't run yet)
    const { data, error } = await supabase
      .from('campgrounds')
      .select('*')
      .eq('owner_id', userId)
      .single()
    if (!error) setCampground(data)
    setLoading(false)
  }

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = async (email, password, campgroundName) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { campground_name: campgroundName } }
    })
    return result
  }

  const signOut = () => supabase.auth.signOut()

  const refreshCampground = () => user && loadCampground(user.id)

  return (
    <AuthContext.Provider value={{ user, campground, loading, signIn, signUp, signOut, refreshCampground }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
