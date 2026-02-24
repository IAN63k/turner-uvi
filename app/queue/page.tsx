'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AppConfig, AttendanceType } from '@/types'
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
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('virtual')
  const [physicalLocation, setPhysicalLocation] = useState<string>('')
  const [physicalPhotos, setPhysicalPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const notifiedRef = useRef(false)

  // Fetch initial config
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('config')
        .select('current_ticket, video_link, attendance_type, physical_location, physical_photos')
        .eq('id', 1)
        .maybeSingle()

      if (data) {
        setCurrentTicket(data.current_ticket)
        setVideoLink(data.video_link)
        setAttendanceType(data.attendance_type ?? 'virtual')
        setPhysicalLocation(data.physical_location ?? '')
        setPhysicalPhotos(data.physical_photos ?? [])
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
          setAttendanceType(newConfig.attendance_type ?? 'virtual')
          setPhysicalLocation(newConfig.physical_location ?? '')
          setPhysicalPhotos(newConfig.physical_photos ?? [])
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
        body:
          attendanceType === 'virtual'
            ? 'Únete a la videollamada ahora.'
            : `Dirígete a: ${physicalLocation || 'el lugar de atención'}`,
        icon: '/favicon.ico',
      })
    }
  }, [isMyTurn, notifPermission, attendanceType, physicalLocation])

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
                {attendanceType === 'virtual' 
                  ? 'Ingresa a la videollamada para ser atendido.'
                  : 'Dirígete al lugar de atención.'}
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
              <div className="space-y-4">
                {attendanceType === 'virtual' ? (
                  /* Virtual attendance */
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
                  /* Physical attendance */
                  <div className="space-y-4">
                    {physicalLocation ? (
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-accent">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="font-semibold">{physicalLocation}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted text-center">
                        El atencionista aún no ha configurado el lugar de atención.
                      </p>
                    )}
                    
                    {/* Photo gallery */}
                    {physicalPhotos.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted text-center">
                          Fotos de referencia
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {physicalPhotos.map((url, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedPhoto(index)}
                              className="aspect-video rounded-xl overflow-hidden bg-surface border border-border hover:border-primary transition-colors cursor-pointer"
                            >
                              <img
                                src={url}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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

      {/* Photo Modal */}
      {selectedPhoto !== null && physicalPhotos[selectedPhoto] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <img
              src={physicalPhotos[selectedPhoto]}
              alt={`Foto ${selectedPhoto + 1}`}
              className="w-full h-auto rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Navigation arrows */}
            {physicalPhotos.length > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPhoto((selectedPhoto - 1 + physicalPhotos.length) % physicalPhotos.length)
                  }}
                  className="pointer-events-auto -ml-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPhoto((selectedPhoto + 1) % physicalPhotos.length)
                  }}
                  className="pointer-events-auto -mr-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            {/* Indicators */}
            {physicalPhotos.length > 1 && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                {physicalPhotos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPhoto(i)
                    }}
                    className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                      i === selectedPhoto ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
