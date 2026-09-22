/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (see index.css :root / .dark)
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        'subtle-foreground': 'hsl(var(--subtle-foreground) / <alpha-value>)',

        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-hover': 'hsl(var(--primary-hover) / <alpha-value>)',
        'primary-soft': 'hsl(var(--primary-soft) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',

        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',

        'grade-a': 'hsl(var(--grade-a) / <alpha-value>)',
        'grade-b': 'hsl(var(--grade-b) / <alpha-value>)',
        'grade-c': 'hsl(var(--grade-c) / <alpha-value>)',
        'grade-d': 'hsl(var(--grade-d) / <alpha-value>)',
        'grade-e': 'hsl(var(--grade-e) / <alpha-value>)',
        'grade-f': 'hsl(var(--grade-f) / <alpha-value>)',

        'chart-1': 'hsl(var(--chart-1) / <alpha-value>)',
        'chart-2': 'hsl(var(--chart-2) / <alpha-value>)',
        'chart-3': 'hsl(var(--chart-3) / <alpha-value>)',
        'chart-4': 'hsl(var(--chart-4) / <alpha-value>)',
        'chart-5': 'hsl(var(--chart-5) / <alpha-value>)',
        'chart-6': 'hsl(var(--chart-6) / <alpha-value>)',
        'chart-7': 'hsl(var(--chart-7) / <alpha-value>)',
        'chart-8': 'hsl(var(--chart-8) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        gutter: '1.25rem',
        'gutter-sm': '0.75rem',
        margin: '1.5rem',
        'margin-mobile': '1rem',
      },
      fontSize: {
        'headline-xl': ['2rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.025em' }],
        'headline-lg': ['1.5rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-md': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        'headline-sm': ['1rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400' }],
        'body-sm': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '400' }],
        'data-metric': ['1.75rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'mono-label': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.05em' }],
        'mono-caption': ['0.6875rem', { lineHeight: '0.875rem', fontWeight: '400' }],
      },
      boxShadow: {
        xs: '0px 1px 2px 0px rgb(16 24 40 / 0.05)',
        sm: '0px 1px 2px 0px rgb(16 24 40 / 0.06)',
        DEFAULT: '0px 1px 3px 0px rgb(16 24 40 / 0.08), 0px 1px 2px -1px rgb(16 24 40 / 0.06)',
        md: '0px 4px 8px -2px rgb(16 24 40 / 0.08), 0px 2px 4px -2px rgb(16 24 40 / 0.06)',
        lg: '0px 12px 16px -4px rgb(16 24 40 / 0.08), 0px 4px 6px -2px rgb(16 24 40 / 0.03)',
        xl: '0px 20px 24px -4px rgb(16 24 40 / 0.08), 0px 8px 8px -4px rgb(16 24 40 / 0.03)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
