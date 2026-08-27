/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#5a8bff',
          500: '#3563ff',
          600: '#1e44e6',
          700: '#1834b8',
          800: '#162d8f',
          900: '#152a73',
        },
        // semantic surface tokens - referenced by the theme-aware classes below
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          muted: 'rgb(var(--c-surface-muted) / <alpha-value>)',
          subtle: 'rgb(var(--c-surface-subtle) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          subtle: 'rgb(var(--c-ink-subtle) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 8px 32px -8px rgba(15, 23, 42, 0.12)',
        'glass-dark': '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px -8px rgba(0, 0, 0, 0.4)',
        glow: '0 0 0 1px rgb(var(--c-brand-glow) / 0.4), 0 8px 24px -6px rgb(var(--c-brand-glow) / 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'blob': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.95)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'blob': 'blob 18s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
