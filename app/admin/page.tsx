'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { QueueEntry, Attendance, AppConfig, UserRole, AttendanceType } from '@/types'
import ConfirmModal from '@/app/components/ConfirmModal'
import Spinner from '@/app/components/Spinner'

type Tab = 'queue' | 'history'
type ConfigTab = 'attendance' | 'none'

export default function AdminDashboard() {
  const router = useRouter()

  // Auth state
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Data state
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [history, setHistory] = useState<Attendance[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('queue')

  // History filters
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<UserRole | 'todos'>('todos')

  // UI state
  const [videoLinkInput, setVideoLinkInput] = useState('')
  const [showNextConfirm, setShowNextConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [savingVideoLink, setSavingVideoLink] = useState(false)

  // Attendance type state
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('virtual')
  const [physicalLocation, setPhysicalLocation] = useState('')
  const [physicalPhotos, setPhysicalPhotos] = useState<string[]>([])
  const [savingAttendanceConfig, setSavingAttendanceConfig] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [configTab, setConfigTab] = useState<ConfigTab>('none')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // ----- AUTH CHECK -----
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
        return
      }
      setAuthed(true)
      setAuthLoading(false)
    }
    checkAuth()
  }, [router])

  // ----- FETCH DATA -----
  const fetchConfig = useCallback(async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).maybeSingle()
    if (data) {
      setConfig(data as AppConfig)
      setVideoLinkInput(data.video_link ?? '')
      setAttendanceType(data.attendance_type ?? 'virtual')
      setPhysicalLocation(data.physical_location ?? '')
      setPhysicalPhotos(data.physical_photos ?? [])
    }
  }, [])

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('queue')
      .select('*')
      .in('status', ['waiting', 'in_progress'])
      .order('ticket_number', { ascending: true })
    if (data) setQueue(data as QueueEntry[])
  }, [])

  const fetchHistory = useCallback(async (from: string, to: string) => {
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .gte('attended_at', `${from}T00:00:00`)
      .lte('attended_at', `${to}T23:59:59`)
      .order('attended_at', { ascending: false })
    if (data) setHistory(data as Attendance[])
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchConfig()
    fetchQueue()
    fetchHistory(dateFrom, dateTo)
  }, [authed, fetchConfig, fetchQueue, fetchHistory, dateFrom, dateTo])

  // ----- FILTERED HISTORY (client-side search + role) -----
  const filteredHistory = useMemo(() => {
    let result = history
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (item) =>
          item.full_name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q)
      )
    }
    if (filterRole !== 'todos') {
      result = result.filter((item) => item.role === filterRole)
    }
    return result
  }, [history, searchQuery, filterRole])

  // ----- CSV DOWNLOAD -----
  const downloadCSV = useCallback(() => {
    const rows = filteredHistory
    if (rows.length === 0) return

    const headers = ['#Turno', 'Nombre', 'Correo', 'Rol', 'Hora atendido', 'Comentario']
    const csvRows = [
      headers.join(','),
      ...rows.map((r) => {
        const time = new Date(r.attended_at).toLocaleString('es-CL', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
        // Escape fields that may contain commas or quotes
        const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
        return [r.ticket_number, esc(r.full_name), esc(r.email), r.role, esc(time), esc(r.comment ?? '')].join(',')
      }),
    ]

    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial-turner-${dateFrom}-a-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredHistory, dateFrom, dateTo])

  // ----- REALTIME -----
  useEffect(() => {
    if (!authed) return

    const queueChannel = supabase
      .channel('admin-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => { fetchQueue() }
      )
      .subscribe()

    const configChannel = supabase
      .channel('admin-config')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'config' },
        (payload) => {
          const newConfig = payload.new as AppConfig
          setConfig(newConfig)
          setVideoLinkInput(newConfig.video_link ?? '')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(queueChannel)
      supabase.removeChannel(configChannel)
    }
  }, [authed, fetchQueue])

  // ----- ACTIONS -----
  const handleNextTicket = async () => {
    if (!config) return

    const currentTicketNumber = config.current_ticket
    const nextTicketNumber = currentTicketNumber + 1

    // Mark current as done
    if (currentTicketNumber > 0) {
      const { data: attended } = await supabase
        .from('queue')
        .update({ status: 'done', attended_at: new Date().toISOString() })
        .eq('ticket_number', currentTicketNumber)
        .eq('status', 'in_progress')
        .select()
        .single()

      if (attended) {
        await supabase.from('attendances').insert({
          queue_id: attended.id,
          full_name: attended.full_name,
          email: attended.email,
          role: attended.role,
          ticket_number: attended.ticket_number,
        })
      }
    }

    // Mark next as in_progress
    await supabase
      .from('queue')
      .update({ status: 'in_progress' })
      .eq('ticket_number', nextTicketNumber)
      .eq('status', 'waiting')

    // Update config
    await supabase
      .from('config')
      .update({ current_ticket: nextTicketNumber })
      .eq('id', 1)

    setShowNextConfirm(false)
    fetchQueue()
    fetchHistory(dateFrom, dateTo)
  }

  const handleCancelTicket = async (id: string) => {
    await supabase
      .from('queue')
      .update({ status: 'cancelled' })
      .eq('id', id)

    setShowCancelConfirm(null)
    fetchQueue()
  }

  const handleSaveVideoLink = async () => {
    setSavingVideoLink(true)
    await supabase
      .from('config')
      .update({ video_link: videoLinkInput.trim() })
      .eq('id', 1)
    setSavingVideoLink(false)
  }

  const handleSaveAttendanceConfig = async () => {
    setSavingAttendanceConfig(true)
    const updateData: Partial<AppConfig> = {
      attendance_type: attendanceType,
    }
    if (attendanceType === 'virtual') {
      updateData.video_link = videoLinkInput.trim()
    } else {
      updateData.physical_location = physicalLocation.trim()
      updateData.physical_photos = physicalPhotos
    }
    await supabase.from('config').update(updateData).eq('id', 1)
    setSavingAttendanceConfig(false)
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || physicalPhotos.length >= 3) return
    
    setUploadingPhoto(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `attendance-photos/${fileName}`

    const { error } = await supabase.storage
      .from('public-assets')
      .upload(filePath, file)

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath)
      
      const newPhotos = [...physicalPhotos, urlData.publicUrl]
      setPhysicalPhotos(newPhotos)
      
      // Save immediately to DB
      await supabase.from('config').update({ physical_photos: newPhotos }).eq('id', 1)
    }
    
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleRemovePhoto = async (index: number) => {
    const newPhotos = physicalPhotos.filter((_, i) => i !== index)
    setPhysicalPhotos(newPhotos)
    await supabase.from('config').update({ physical_photos: newPhotos }).eq('id', 1)
  }

  const handleSaveComment = async (attendanceId: string) => {
    setSavingComment(true)
    await supabase
      .from('attendances')
      .update({ comment: commentText })
      .eq('id', attendanceId)
    setSavingComment(false)
    setEditingComment(null)
    setCommentText('')
    fetchHistory(dateFrom, dateTo)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const handleResetQueue = async () => {
    await supabase
      .from('queue')
      .update({ status: 'cancelled' })
      .in('status', ['waiting', 'in_progress'])

    await supabase
      .from('config')
      .update({ current_ticket: 0, last_reset_at: new Date().toISOString() })
      .eq('id', 1)

    fetchQueue()
  }

  // ----- DERIVED -----
  const waitingQueue = queue.filter((q) => q.status === 'waiting')
  const currentEntry = queue.find((q) => q.status === 'in_progress')
  const nextInLine = waitingQueue[0]

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center font-sans">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  if (!authed) return null

  return (
    <div className="min-h-dvh bg-background font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white text-sm font-bold">
              T
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">Turner</h1>
              <p className="text-[11px] text-muted">Panel de atención</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        {/* Current ticket panel */}
        <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in-up">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* Current ticket info */}
            <div className="flex items-center gap-5">
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white text-2xl font-bold shadow-lg ${
                currentEntry ? 'bg-success shadow-success/20' : 'bg-muted/50 shadow-none'
              }`}>
                {config?.current_ticket ? `#${config.current_ticket}` : '—'}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Atendiendo ahora</p>
                {currentEntry ? (
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-foreground">{currentEntry.full_name}</p>
                    <p className="text-sm text-muted">{currentEntry.email} · {currentEntry.role}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted">Ningún turno activo</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
              {/* Attendance config toggle */}
              <button
                onClick={() => setConfigTab(configTab === 'attendance' ? 'none' : 'attendance')}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-all cursor-pointer ${
                  configTab === 'attendance'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface border-border text-foreground hover:bg-card-hover'
                }`}
              >
                ⚙️ Tipo de atención
              </button>

              {/* Next ticket button */}
              <button
                onClick={() => setShowNextConfirm(true)}
                disabled={!nextInLine && !currentEntry}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente turno →
              </button>
            </div>
          </div>

          {/* Attendance Configuration Panel */}
          {configTab === 'attendance' && (
            <div className="mt-5 pt-5 border-t border-border animate-fade-in-up">
              <div className="flex flex-col gap-4">
                {/* Type selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted">
                    Modalidad de atención
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAttendanceType('virtual')}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium border-2 transition-all cursor-pointer ${
                        attendanceType === 'virtual'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-surface text-muted hover:border-muted'
                      }`}
                    >
                      🎥 Virtual
                    </button>
                    <button
                      onClick={() => setAttendanceType('physical')}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium border-2 transition-all cursor-pointer ${
                        attendanceType === 'physical'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-surface text-muted hover:border-muted'
                      }`}
                    >
                      🏢 Presencial
                    </button>
                  </div>
                </div>

                {/* Virtual: Video link */}
                {attendanceType === 'virtual' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted">
                      Enlace de videollamada
                    </label>
                    <input
                      type="url"
                      value={videoLinkInput}
                      onChange={(e) => setVideoLinkInput(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {/* Physical: Location + Photos */}
                {attendanceType === 'physical' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted">
                        Lugar de atención
                      </label>
                      <input
                        type="text"
                        value={physicalLocation}
                        onChange={(e) => setPhysicalLocation(e.target.value)}
                        placeholder="Ej: Oficina 302, Edificio Central..."
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted">
                        Fotos de orientación ({physicalPhotos.length}/3)
                      </label>
                      
                      {/* Photo grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {physicalPhotos.map((url, index) => (
                          <div key={index} className="relative group aspect-video rounded-xl overflow-hidden bg-surface border border-border">
                            <img
                              src={url}
                              alt={`Foto ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => handleRemovePhoto(index)}
                              className="absolute top-1 right-1 p-1 rounded-lg bg-danger text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        
                        {physicalPhotos.length < 3 && (
                          <label className="aspect-video rounded-xl border-2 border-dashed border-border bg-surface hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1">
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleUploadPhoto}
                              className="hidden"
                              disabled={uploadingPhoto}
                            />
                            {uploadingPhoto ? (
                              <Spinner className="w-5 h-5 text-muted" />
                            ) : (
                              <>
                                <span className="text-lg">📷</span>
                                <span className="text-xs text-muted">Agregar</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Save button */}
                <button
                  onClick={handleSaveAttendanceConfig}
                  disabled={savingAttendanceConfig}
                  className="self-end rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-success/20 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {savingAttendanceConfig ? 'Guardando...' : '💾 Guardar configuración'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-surface p-1">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Cola de espera ({waitingQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Historial
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'queue' ? (
          <section className="animate-fade-in-up">
            {waitingQueue.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-16 text-center">
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-sm font-medium text-foreground">No hay personas en espera</p>
                <p className="mt-1 text-xs text-muted">La cola está vacía por ahora.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Nombre</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">Correo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted hidden md:table-cell">Rol</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">Espera</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border stagger">
                      {waitingQueue.map((entry) => {
                        const waitMinutes = Math.floor(
                          (Date.now() - new Date(entry.created_at).getTime()) / 60000
                        )
                        return (
                          <tr key={entry.id} className="hover:bg-card-hover transition-colors animate-fade-in-up">
                            <td className="px-4 py-3 font-mono font-bold text-primary">
                              {entry.ticket_number}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {entry.full_name}
                            </td>
                            <td className="px-4 py-3 text-muted hidden sm:table-cell">
                              {entry.email}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${
                                entry.role === 'profesor'
                                  ? 'bg-accent/10 text-accent'
                                  : 'bg-primary-light text-primary'
                              }`}>
                                {entry.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted font-mono text-xs hidden lg:table-cell">
                              {waitMinutes < 1 ? '< 1 min' : `${waitMinutes} min`}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setShowCancelConfirm(entry.id)}
                                className="rounded-lg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-light transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reset queue button */}
            {waitingQueue.length > 0 && (
              <div className="mt-4 text-right">
                <button
                  onClick={handleResetQueue}
                  className="text-xs text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Resetear toda la cola
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="animate-fade-in-up">
            {/* Filters bar */}
            <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                {/* Date range */}
                <div className="flex items-center gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted">Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <span className="mt-5 text-muted">→</span>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted">Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Search */}
                <div className="flex-1 min-w-0">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted">Buscar</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nombre o correo…"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Role filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted">Rol</label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as UserRole | 'todos')}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="todos">Todos</option>
                    <option value="estudiante">Estudiante</option>
                    <option value="profesor">Profesor</option>
                  </select>
                </div>

                {/* Download */}
                <button
                  onClick={downloadCSV}
                  disabled={filteredHistory.length === 0}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-card-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Descargar CSV"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  CSV
                </button>
              </div>

              {/* Filter summary */}
              {(searchQuery.trim() || filterRole !== 'todos') && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <span>Mostrando {filteredHistory.length} de {history.length} registros</span>
                  {(searchQuery.trim() || filterRole !== 'todos') && (
                    <button
                      onClick={() => { setSearchQuery(''); setFilterRole('todos') }}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-16 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm font-medium text-foreground">Sin registros</p>
                <p className="mt-1 text-xs text-muted">
                  {history.length > 0
                    ? 'Ningún registro coincide con los filtros aplicados.'
                    : 'No hay atenciones registradas para este rango de fechas.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Nombre</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">Rol</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted hidden md:table-cell">Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Comentario</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-card-hover transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            {item.ticket_number}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{item.full_name}</p>
                            <p className="text-xs text-muted sm:hidden">{item.role}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${
                              item.role === 'profesor'
                                ? 'bg-accent/10 text-accent'
                                : 'bg-primary-light text-primary'
                            }`}>
                              {item.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted font-mono text-xs hidden md:table-cell">
                            {new Date(item.attended_at).toLocaleTimeString('es-CL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-muted text-xs max-w-50 truncate">
                            {item.comment || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setEditingComment(item.id)
                                setCommentText(item.comment ?? '')
                              }}
                              className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-light transition-colors cursor-pointer"
                            >
                              {item.comment ? 'Editar' : 'Comentar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modals */}
      {showNextConfirm && (
        <ConfirmModal
          title="Siguiente turno"
          message={
            nextInLine
              ? `¿Pasar al turno #${nextInLine.ticket_number} (${nextInLine.full_name})? Esto notificará al usuario.`
              : currentEntry
                ? `¿Finalizar la atención de #${currentEntry.ticket_number} (${currentEntry.full_name})?`
                : 'No hay turnos pendientes.'
          }
          confirmLabel="Confirmar"
          onConfirm={handleNextTicket}
          onCancel={() => setShowNextConfirm(false)}
        />
      )}

      {showCancelConfirm && (
        <ConfirmModal
          title="Cancelar turno"
          message="¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer."
          confirmLabel="Cancelar turno"
          variant="danger"
          onConfirm={() => handleCancelTicket(showCancelConfirm)}
          onCancel={() => setShowCancelConfirm(null)}
        />
      )}

      {/* Comment edit modal */}
      {editingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay" onClick={() => { setEditingComment(null); setCommentText('') }} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl animate-fade-in-up">
            <h3 className="text-lg font-semibold text-foreground">Agregar comentario</h3>
            <p className="mt-1 text-sm text-muted">Notas sobre la atención de este turno.</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              placeholder="Escribe un comentario..."
              className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/50 outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setEditingComment(null); setCommentText('') }}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveComment(editingComment)}
                disabled={savingComment}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer disabled:opacity-50"
              >
                {savingComment ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
