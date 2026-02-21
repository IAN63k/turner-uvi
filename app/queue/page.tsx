'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AppConfig } from '@/types'
import Spinner from '@/app/components/Spinner'

export default function QueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-4 font-sans">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      }
    >
      <QueueContent />
    </Suspense>
  )
}

function QueueContent() {
  const searchParams = useSearchParams()
  const queueId = searchParams.get('id')
  const ticketNumber = Number(searchParams.get('ticket') ?? 0)

  const [currentTicket, setCurrentTicket] = useState<number>(0)
  const [videoLink, setVideoLink] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const notifiedRef = useRef(false)

  // Fetch initial config
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('config')
        .select('current_ticket, video_link')
        .eq('id', 1)
        .maybeSingle()

      if (data) {
        setCurrentTicket(data.current_ticket)
        setVideoLink(data.video_link)
      }
      setLoading(false)
    }
    fetchConfig()
  }, [])

  // Realtime subscription to config updates
  useEffect(() => {
    const channel = supabase
      .channel('config-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'config' },
        (payload) => {
          const newConfig = payload.new as AppConfig
          setCurrentTicket(newConfig.current_ticket)
          setVideoLink(newConfig.video_link)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Check notification permission
  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifPermission('unsupported')
    } else {
      setNotifPermission(Notification.permission)
    }
  }, [])

  const requestNotifications = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
    }
  }, [])

  // Fire notification when it's our turn
  const isMyTurn = ticketNumber > 0 && currentTicket === ticketNumber

  useEffect(() => {
    if (isMyTurn && !notifiedRef.current && notifPermission === 'granted') {
      notifiedRef.current = true
      new Notification('¡Es tu turno!', {
        body: 'Únete a la videollamada ahora.',
        icon: '/favicon.ico',
      })
    }
  }, [isMyTurn, notifPermission])

  const peopleAhead = Math.max(0, ticketNumber - currentTicket - 1)
  const hasBeenServed = currentTicket > ticketNumber && ticketNumber > 0

  if (!queueId || ticketNumber <= 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 font-sans">
        <div className="text-center">
          <p className="text-muted mb-4">No se encontró información de turno.</p>
          <a href="/" className="text-primary hover:underline font-medium text-sm">
            ← Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 font-sans">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12 font-sans">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <main className="relative w-full max-w-md stagger">
        {/* Ticket badge */}
        <div className="text-center animate-fade-in-up">
          <div className={`mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-3xl text-white text-4xl font-bold shadow-xl ${
            isMyTurn
              ? 'bg-success shadow-success/30 animate-pulse-ring'
              : hasBeenServed
                ? 'bg-muted shadow-muted/20'
                : 'bg-primary shadow-primary/25'
          }`}>
            #{ticketNumber}
          </div>

          {isMyTurn ? (
            <>
              <h1 className="text-2xl font-bold text-success">
                ¡Es tu turno!
              </h1>
              <p className="mt-2 text-sm text-muted">
                Ingresa a la videollamada para ser atendido.
              </p>
            </>
          ) : hasBeenServed ? (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                Turno finalizado
              </h1>
              <p className="mt-2 text-sm text-muted">
                Tu turno ya fue atendido. Gracias por tu paciencia.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                Estás en espera
              </h1>
              <p className="mt-2 text-sm text-muted">
                Tu turno llegará pronto. No cierres esta página.
              </p>
            </>
          )}
        </div>

        {/* Status Card */}
        {!hasBeenServed && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            {isMyTurn ? (
              <div className="text-center">
                {videoLink ? (
                  <a
                    href={videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-success/25 transition-all hover:shadow-xl hover:shadow-success/30 active:scale-[0.98]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    Unirse a la videollamada
                  </a>
                ) : (
                  <p className="text-sm text-muted">
                    El atencionista aún no ha configurado el enlace de videollamada.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Turno actual</span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    #{currentTicket || '—'}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Tu turno</span>
                  <span className="font-mono text-lg font-bold text-primary">
                    #{ticketNumber}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Personas antes que tú</span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {peopleAhead}
                  </span>
                </div>

                {/* Progress bar */}
                {ticketNumber > 0 && (
                  <div className="pt-2">
                    <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, Math.max(5, ((currentTicket) / ticketNumber) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification permission */}
        {!isMyTurn && !hasBeenServed && notifPermission === 'default' && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-start gap-3">
              <span className="text-lg">🔔</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Activa las notificaciones
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Te avisaremos cuando sea tu turno.
                </p>
                <button
                  onClick={requestNotifications}
                  className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover cursor-pointer"
                >
                  Activar
                </button>
              </div>
            </div>
          </div>
        )}

        {notifPermission === 'granted' && !isMyTurn && !hasBeenServed && (
          <p className="mt-4 text-center text-xs text-success animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            ✓ Notificaciones activadas — te avisaremos cuando sea tu turno
          </p>
        )}

        {/* Back link */}
        <p className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <a href="/" className="text-xs text-muted hover:text-foreground transition-colors">
            ← Volver al inicio
          </a>
        </p>
      </main>
    </div>
  )
}
