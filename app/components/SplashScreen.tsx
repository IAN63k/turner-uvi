'use client'

import { useState, useEffect, useCallback } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

/**
 * Componente de pantalla de presentación (Splash Screen) para la aplicación.
 * 
 * Muestra un diseño de bienvenida con el logo de UVI y la institución "UNIAJC VIRTUAL"
 * durante 2.5 segundos, con una animación de salida suave antes de finalizar.
 * 
 * @component
 * @example
 * const [showSplash, setShowSplash] = useState(true);
 * return <SplashScreen onFinish={() => setShowSplash(false)} />
 * 
 * @param {SplashScreenProps} props - Propiedades del componente
 * @param {Function} props.onFinish - Callback ejecutado cuando la pantalla de presentación finaliza
 * 
 * @returns {JSX.Element} Un div fijo que cubre toda la pantalla con animaciones de entrada y salida
 * 
 * @remarks
 * - La pantalla se muestra durante 2500ms antes de iniciar la animación de salida
 * - La transición de salida dura 700ms
 * - Utiliza estilos Tailwind CSS con clases personalizadas para animaciones
 * - Las letras del logo tienen animación escalonada basada en índice
 * - Incluye una barra de progreso animada en la parte inferior
 */
export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(onFinish, 700)
  }, [onFinish])

  useEffect(() => {
    const timer = setTimeout(dismiss, 2500)
    return () => clearTimeout(timer)
  }, [dismiss])

  return (
    <div
      className={`splash-overlay fixed inset-0 z-100 flex flex-col items-center justify-center bg-white${
        exiting ? ' splash-exiting' : ''
      }`}
      aria-hidden="true"
    >
      {/* Background layers */}
      <div className="absolute inset-0 splash-bg" />
      <div className="absolute inset-0 splash-glow" />

      {/* Logo composition */}
      <div className="relative flex flex-col items-center">
        {/* UVI letters */}
        <div className="flex items-baseline" role="img" aria-label="UVI">
          {['U', 'V', 'I'].map((ch, i) => (
            <span
              key={ch}
              className="splash-letter text-[#00529c] font-sans select-none"
              style={{
                fontSize: 'clamp(5rem, 20vw, 10rem)',
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                animationDelay: `${200 + i * 150}ms`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        {/* Divider + Institution name */}
        <div className="splash-meta flex items-center gap-3 mt-2">
          <div className="splash-divider h-11 w-px bg-[#00529c]/30" />
          <div
            className="text-black font-sans font-bold uppercase leading-tight"
            style={{
              fontSize: 'clamp(0.72rem, 2.8vw, 1.05rem)',
              letterSpacing: '0.12em',
            }}
          >
            UNIAJC
            <br />
            VIRTUAL
          </div>
        </div>
      </div>

      {/* App subtitle */}
      <p
        className="splash-app-title mt-10 text-black/30 font-sans font-medium uppercase"
        style={{ fontSize: 'clamp(0.55rem, 1.3vw, 0.7rem)' }}
      >
        Gestión de Turnos
      </p>

      {/* Progress bar */}
      <div className="absolute bottom-16 w-14 h-[2px] rounded-full bg-[#00529c]/10 overflow-hidden">
        <div className="splash-progress-bar h-full bg-[#00529c]/40 rounded-full" />
      </div>
    </div>
  )
}
