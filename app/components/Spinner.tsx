/**
 * Componente Spinner - Indicador de carga animado
 * 
 * Renderiza un ícono SVG con animación de rotación continua,
 * comúnmente utilizado para indicar que una operación se encuentra en progreso.
 * 
 * @component
 * @param {Object} props - Las propiedades del componente
 * @param {string} [props.className=''] - Clases CSS adicionales para personalizar el estilo del spinner.
 *                                         Se concatenan con las clases por defecto de animación y tamaño.
 * 
 * @returns {JSX.Element} Elemento SVG animado con estilos de opacidad en dos capas circulares
 * 
 * @example
 * // Uso básico
 * <Spinner />
 * 
 * @example
 * // Con clases CSS personalizadas
 * <Spinner className="text-blue-500" />
 */
export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
