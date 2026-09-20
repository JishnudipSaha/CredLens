import { useTheme } from '../theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="relative w-9 h-9 grid place-items-center rounded-lg hover:bg-surface-container-low transition-colors overflow-hidden"
    >
      <span
        className={`absolute transition-all duration-500 ${isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}
        aria-hidden
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">light_mode</span>
      </span>
      <span
        className={`absolute transition-all duration-500 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}
        aria-hidden
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">dark_mode</span>
      </span>
    </button>
  )
}
