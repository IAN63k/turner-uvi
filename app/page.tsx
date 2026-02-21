'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'
import Spinner from '@/app/components/Spinner'
import SplashScreen from '@/app/components/SplashScreen'

const LS_KEY = 'turner_user_data'

interface SavedUserData {
  fullName: string
  email: string
  role: UserRole
}

function loadSavedData(): SavedUserData | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.fullName && parsed.email && (parsed.role === 'estudiante' || parsed.role === 'profesor')) {
      return parsed as SavedUserData
    }
  } catch { /* ignore */ }
  return null
}

function saveData(data: SavedUserData) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export default function Home() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('estudiante')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    const saved = loadSavedData()
    if (saved) {
      setFullName(saved.fullName)
      setEmail(saved.email)
      setRole(saved.role)
    }
    setHydrated(true)
  }, [])

  // Persist on change (after hydration)
  useEffect(() => {
    if (!hydrated) return
    saveData({ fullName, email, role })
  }, [fullName, email, role, hydrated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || !email.trim()) {
      setError('Por favor completa todos los campos.')
      return
    }

    setLoading(true)
    try {
      const { data, error: insertError } = await supabase
        .from('queue')
        .insert({ full_name: fullName.trim(), email: email.trim(), role })
        .select('id, ticket_number')
        .single()

      if (insertError) throw insertError

      // Navigate to waiting page with the queue entry id
      router.push(`/queue?id=${data.id}&ticket=${data.ticket_number}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}

    <div className="flex min-h-dvh items-center justify-center px-4 py-12 font-sans">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <main className="relative w-full max-w-md stagger">
        {/* Header */}
        <div className={`mb-10 text-center ${splashDone ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Toma tu turno
          </h1>
          <p className="mt-2 text-sm text-muted">
            Completa tus datos para entrar a la cola de atención virtual.
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${splashDone ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={splashDone ? { animationDelay: '100ms' } : undefined}
        >
          {error && (
            <div className="mb-5 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Nombre completo */}
          <div className="mb-5">
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: María González"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Correo institucional */}
          <div className="mb-5">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              Correo institucional
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@estudiante.uniajc.edu.co"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Rol */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-foreground">
              Rol
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('estudiante')}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                  role === 'estudiante'
                    ? 'border-primary bg-primary-light text-primary shadow-sm'
                    : 'border-border bg-surface text-muted hover:border-foreground/20'
                }`}
              >
                🎓 Estudiante
              </button>
              <button
                type="button"
                onClick={() => setRole('profesor')}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                  role === 'profesor'
                    ? 'border-primary bg-primary-light text-primary shadow-sm'
                    : 'border-border bg-surface text-muted hover:border-foreground/20'
                }`}
              >
                📚 Profesor
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4 text-white" />
                Registrando…
              </>
            ) : (
              'Tomar turno'
            )}
          </button>
        </form>

        {/* Admin link */}
        <p
          className={`mt-6 text-center text-xs text-muted ${splashDone ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={splashDone ? { animationDelay: '200ms' } : undefined}
        >
          ¿Eres atencionista?{' '}
          <a href="/admin/login" className="text-primary hover:underline font-medium">
            Ingresar al panel
          </a>
        </p>
      </main>
    </div>
    </>
  )
}
