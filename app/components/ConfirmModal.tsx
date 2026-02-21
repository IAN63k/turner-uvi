'use client'

import { useState } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

/**
 * Modal de confirmación reutilizable con soporte para variantes de estilo y manejo de estados de carga.
 * 
 * @component
 * @example
 * <ConfirmModal
 *   title="Eliminar elemento"
 *   message="¿Está seguro de que desea eliminar este elemento?"
 *   variant="danger"
 *   confirmLabel="Eliminar"
 *   onConfirm={() => deleteItem()}
 *   onCancel={() => closeModal()}
 * />
 * 
 * @param {ConfirmModalProps} props - Las propiedades del componente
 * @param {string} props.title - Título del modal
 * @param {string} props.message - Mensaje de confirmación a mostrar
 * @param {string} [props.confirmLabel='Confirmar'] - Etiqueta del botón de confirmación
 * @param {string} [props.cancelLabel='Cancelar'] - Etiqueta del botón de cancelación
 * @param {('primary' | 'danger')} [props.variant='primary'] - Variante de estilo del botón de confirmación
 * @param {() => Promise<void>} props.onConfirm - Callback ejecutado al confirmar. Se ejecuta de forma asincrónica
 * @param {() => void} props.onCancel - Callback ejecutado al cancelar o al hacer clic fuera del modal
 * 
 * @returns {JSX.Element} El elemento modal de confirmación
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  const btnColor =
    variant === 'danger'
      ? 'bg-danger hover:bg-red-600 text-white'
      : 'bg-primary hover:bg-primary-hover text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl animate-fade-in-up">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${btnColor} ${loading ? 'opacity-60' : ''}`}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
