# CredLens Design System

**Institutional Light + First-Class Dark Mode**

This document defines the UI design system for CredLens — a clean, data-dense aesthetic inspired by Bloomberg Terminal and NCDEX dashboards. Every color is a semantic CSS variable, so the whole product works in both light and dark themes with one class toggle.

---

## Design Principles

1. **Data Density** — maximize information per viewport without clutter
2. **Institutional Trust** — conservative navy palette, clean typography, solid surfaces
3. **Precision** — monospaced fonts for numeric data, exact alignment, clear hierarchy
4. **Accessibility** — WCAG AA contrast, visible focus rings, semantic HTML, keyboard navigation
5. **Theme Parity** — components never hard-code colors; they use semantic tokens so light and dark mode stay correct

---

## Theming Architecture

| Piece | Where | What it does |
|---|---|---|
| Tokens | `frontend/src/index.css` (`:root` / `.dark`) | HSL triplets as CSS custom properties, e.g. `--primary: 229 74% 46%` |
| Tailwind mapping | `frontend/tailwind.config.js` | Each token exposed as `hsl(var(--x) / <alpha-value>)`, so `bg-card`, `text-muted-foreground`, `border-border` and opacity modifiers (`bg-primary/10`) all work |
| Dark toggle | `.dark` class on `<html>` (`src/theme.tsx`) | Preference persisted in `localStorage` under `credlens_theme` |
| Anti-flash bootstrap | inline script in `index.html` | Applies the stored theme (or `prefers-color-scheme` on first visit) before first paint |

**Rule:** components color themselves with semantic classes only (`bg-card`, `text-subtle-foreground`, `border-border`). Literal colors are allowed only for intentionally fixed surfaces (e.g. the login page's pinned dark brand panel `#101828`).

---

## Color Palette

### Core surfaces

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#f6f6f9` | `#090d15` | Page canvas |
| `card` | `#ffffff` | `#0d121c` | Cards, sidebar, inputs |
| `muted` | `#f0f0f4` | `#131925` | Table headers, subtle fills |
| `accent` | `#ebebf0` | `#1a202e` | Hover fills |
| `border` | `#e2e2e9` | `#1c2331` | Default borders / dividers |
| `border-strong` | `#c9c9d4` | `#293142` | Emphasized borders |

### Text

| Token | Light | Dark | Usage |
|---|---|---|---|
| `foreground` | `#111827` | `#f3f4f7` | Primary text |
| `muted-foreground` | `#5c6475` | `#9ea5b3` | Secondary text, labels |
| `subtle-foreground` | `#788191` | `#7a8190` | Tertiary text, captions, mono labels |

### Brand

| Token | Light | Dark | Usage |
|---|---|---|---|
| `primary` | `#1e3ecc` | `#637cee` | Buttons, links, active nav, key values |
| `primary-hover` | `#1933a9` | `#7e93f1` | Primary hover state |
| `primary-soft` | `#eceffe` | `#1c2445` | Primary tinted backgrounds |
| `primary-foreground` | `#ffffff` | `#0c111d` | Text on primary backgrounds |
| `ring` | `#1e3ecc` | `#637cee` | Focus ring |

### Semantic

| Token | Light | Dark | Usage |
|---|---|---|---|
| `success` | `#1c8252` | `#61d19d` | APPROVE, healthy states |
| `warning` | `#b15e0b` | `#f6b451` | REVIEW, caution states |
| `danger` | `#b81e1e` | `#f47c7c` | REJECT, errors, red flags |

### Grade colors (300–900 score scale)

| Grade | Score band | Light | Dark |
|---|---|---|---|
| A | 800+ | `#1c8252` | `#61d19d` |
| B | 740–799 | `#1670ca` | `#5fa8f2` |
| C | 680–739 | `#b15e0b` | `#f6b451` |
| D | 620–679 | `#da5e0b` | `#f69351` |
| E | 560–619 | `#b81e1e` | `#f47c7c` |
| F | < 560 | `#a3293d` | `#f0758a` |

### Chart palette

| Token | Light | Dark |
|---|---|---|
| `chart-1` | `#1e3ecc` | `#637cee` |
| `chart-2` | `#20925d` | `#59cf98` |
| `chart-3` | `#d8730e` | `#f5b047` |
| `chart-4` | `#187adc` | `#5fa8f2` |
| `chart-5` | `#d32222` | `#f37272` |
| `chart-6` | `#6826d9` | `#a87ef1` |
| `chart-7` | `#e9640c` | `#f6995a` |
| `chart-8` | `#199eb3` | `#51d7ec` |

Charts read these tokens live via `useChartColors()` (`components/charts.tsx`), which re-reads the CSS variables whenever the theme changes.

---

## Typography

### Font families

| Family | Weights | Usage |
|---|---|---|
| **Inter** | 400, 500, 600, 700 | UI text, headlines, body |
| **JetBrains Mono** | 400, 500 | Data values, labels, badges, code |

Loaded from Google Fonts in `index.html`.

### Type scale (from `tailwind.config.js`)

| Token | Size / line-height | Weight | Usage |
|---|---|---|---|
| `headline-xl` | 32px / 40px | 700 | Page hero titles |
| `headline-lg` | 24px / 32px | 700 | Page titles |
| `headline-md` | 20px / 28px | 600 | Card titles, section heads |
| `headline-sm` | 16px / 24px | 600 | Small card titles |
| `body-lg` | 16px / 24px | 400 | Lead paragraphs |
| `body-md` | 14px / 22px | 400 | Body text, table cells |
| `body-sm` | 12px / 18px | 400 | Secondary text |
| `data-metric` | 28px / 32px | 700 | KPI values, score displays |
| `mono-label` | 11px / 16px | 500 | Uppercase table/section labels (+0.05em tracking) |
| `mono-caption` | 11px / 16px | 400 | Timestamps, metadata |

---

## Layout & Navigation

- **Sidebar:** fixed left, **248px** wide, `bg-card` + right border, visible at **≥1024px** (`lg:`)
- **Mobile nav:** hamburger in the header opens a slide-over drawer with a dimmed backdrop (below `lg`)
- **Header:** sticky top, 56px tall, `bg-background/85` + `backdrop-blur`, bottom border; breadcrumbs left, theme toggle + user + sign out right
- **Content:** `max-w-[1440px]`, horizontal padding `16 / 24 / 32px` (`px-4 → sm:px-6 → lg:px-8`), footer inside the content column
- **Login:** split screen — pinned dark navy brand panel (`#101828`, always dark in both themes) + sign-in form; the compact logo row appears above the form on mobile
- **Shadows:** `shadow-xs → shadow-xl` scale in `tailwind.config.js` (soft, cool-tinted)

---

## Components

### Primitives — `components/UI.tsx`

| Component | Notes |
|---|---|
| `Card` | Panel surface with optional title/subtitle/action |
| `Button` | Variants: `primary`, `secondary`, `ghost`, `danger`, `success`, `warning`; sizes `sm`/`md`; `loading` state |
| `Badge` | Pill badge; pair with `badgeTone()` from `utils/format.ts` |
| `Alert` | Tones: `info`, `success`, `warning`, `error` |
| `Stat` | KPI tile (label, value, hint, optional icon) |
| `EmptyState`, `ErrorState`, `Spinner`, `Skeleton`, `TableWrap` | States + table shell |
| `errorMessage()` | Normalizes API errors to a readable string |

### Shell & feature components

| File | Exports |
|---|---|
| `components/Layout.tsx` | Role-based sidebar/drawer + sticky header + breadcrumbs + footer |
| `components/ScoreGauge.tsx` | `ScoreGauge` — SVG arc gauge for 300–900 with grade chip |
| `components/ThemeToggle.tsx` | `ThemeToggle` — Sun/Moon light-dark switch |
| `components/Toast.tsx` | `ToastProvider` + `useToast()` — top-right toast stack |
| `components/ErrorBoundary.tsx` | `ErrorBoundary` — app-level React error fallback |
| `components/charts.tsx` | `useChartColors`, `ChartCard`, `ChartTooltip`, `axisProps` — theme-aware Recharts helpers |

### CSS component classes — `index.css` (`@layer components`)

- **`.input` / `.select`** — 40px form controls; hover strengthens the border, focus shows a 3px ring at 16% `--ring` alpha; `.select` embeds its own chevron
- **`.panel`** — `rounded-xl border bg-card shadow-xs`
- **`.tbl`** — data tables: muted uppercase mono headers, bordered rows, hover fill, `.num` right-aligned tabular figures
- **Global** — themed scrollbars, primary-tinted `::selection`, `:focus-visible` ring on every interactive element, `prefers-reduced-motion` disables animation

---

## Icons

**Library:** [Lucide](https://lucide.dev) via `lucide-react` (the Material Symbols font CDN was removed).

```tsx
import { Landmark, ShieldCheck, ArrowRight } from 'lucide-react'

<Landmark className="h-4 w-4" aria-hidden />
```

Common by section:
- **Navigation:** `LayoutDashboard`, `Search`, `Scale`, `Gauge`, `Upload`, `History`, `BarChart3`, `Monitor`, `ScrollText`
- **Actions:** `LogOut`, `Sun`, `Moon`, `ArrowRight`, `ChevronRight`
- **Data:** `IndianRupee`, `TrendingUp`, `BadgeCheck`, `Landmark`, `PieChart`
- **Status:** `CheckCircle2`, `AlertTriangle`, `XCircle`, `Info`

Decorative icons are always `aria-hidden`.

---

## Accessibility

- Semantic token pairs target AA contrast in both themes (e.g. `#111827` on `#f6f6f9`, `#f3f4f7` on `#090d15`)
- Visible focus ring (`--ring`, 2px outline with offset) on all interactive elements
- `prefers-reduced-motion: reduce` kills animations and transitions
- Real `<table>`, `<label>`, `<button>` semantics; errors announced via `Alert`

---

## File Reference

| File | Purpose |
|---|---|
| `src/index.css` | All design tokens (`:root` / `.dark`), base styles, component classes |
| `tailwind.config.js` | Token→utility mapping, type scale, spacing, shadows, keyframes |
| `index.html` | Google Fonts (Inter, JetBrains Mono) + anti-flash theme bootstrap |
| `src/theme.tsx` | Theme provider (`credlens_theme` in localStorage) |
| `src/components/Layout.tsx` | Sidebar / drawer + header shell |
| `src/components/UI.tsx` | Card, Button, Badge, Alert, Stat, states |
| `src/components/ScoreGauge.tsx` | Score gauge |
| `src/components/ThemeToggle.tsx` | Light/dark toggle |
| `src/components/Toast.tsx` | Toast system |
| `src/components/ErrorBoundary.tsx` | Error boundary |
| `src/components/charts.tsx` | Theme-aware chart helpers |
| `src/utils/format.ts` | INR/date formatting, score/grade/outcome color maps |
| `src/utils/cn.ts` | `clsx` class-name helper |

---

## Design References

The `designs/` folder contains 11 Google Stitch design references (brand explorations and page comps), each holding reference assets such as a self-contained `code.html` and/or a `screen.png`. See `README.md` for the folder list.
