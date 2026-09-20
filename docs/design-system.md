# CredLens Design System

**Modern Institutional Minimalism with Precision Data Density**

This document defines the UI design system for CredLens — a clean, data-dense aesthetic inspired by Bloomberg Terminal and NCDEX dashboards. The design prioritizes readability, trust, and professional authority over decorative elements.

---

## Design Principles

1. **Data Density** — maximize information per viewport without clutter
2. **Institutional Trust** — conservative color palette, clean typography, solid backgrounds
3. **Precision** — monospaced fonts for numeric data, exact alignment, clear hierarchy
4. **Accessibility** — WCAG AA contrast ratios, semantic HTML, keyboard navigation

---

## Color Palette

### Primary (Navy / Trust)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#00236f` | Headlines, active nav, links |
| `primary-container` | `#d6e3ff` | Sidebar active state, icon backgrounds |
| `on-primary` | `#ffffff` | Text on primary backgrounds |
| `on-primary-container` | `#001a41` | Text on primary-container |

### Secondary (Vivid Blue / Action)

| Token | Hex | Usage |
|---|---|---|
| `secondary` | `#0051d5` | Buttons, accents, chart lines |
| `secondary-container` | `#d8e2ff` | Secondary badges, warnings |
| `on-secondary` | `#ffffff` | Text on secondary backgrounds |

### Tertiary (Green / Success)

| Token | Hex | Usage |
|---|---|---|
| `tertiary-container` | `#0f9d58` | Approved states, success messages |
| `on-tertiary-container` | `#ffffff` | Text on success backgrounds |

### Surface (Backgrounds)

| Token | Hex | Usage |
|---|---|---|
| `background` | `#f8f9ff` | Page background |
| `surface` | `#ffffff` | Card backgrounds |
| `surface-container-lowest` | `#ffffff` | Elevated cards |
| `surface-container-low` | `#f1f3f9` | Hover states, secondary surfaces |
| `surface-container` | `#e8eaf3` | Inactive badges, chips |

### Text

| Token | Hex | Usage |
|---|---|---|
| `on-surface` | `#1a1c1e` | Primary text |
| `on-surface-variant` | `#44474e` | Secondary text, labels |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `error` | `#ba1a1a` | Rejected states, errors |
| `error-container` | `#ffdad6` | Error backgrounds |
| `outline-variant` | `#c7c7cc` | Borders, dividers |

---

## Typography

### Font Families

| Family | Weight | Usage |
|---|---|---|
| **Inter** | 400, 500, 600, 700 | UI text, headlines, body |
| **JetBrains Mono** | 400, 500 | Data values, labels, code, badges |

### Type Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `headline-lg` | 28px / 1.75rem | 700 | Page titles |
| `headline-sm` | 20px / 1.25rem | 700 | Card titles, sidebar logo |
| `data-metric` | 32px / 2rem | 700 | KPI values, score displays |
| `body-md` | 16px / 1rem | 400 | Body text, descriptions |
| `body-sm` | 14px / 0.875rem | 400 | Secondary text, table cells |
| `mono-caption` | 12px / 0.75rem | 400 | Timestamps, metadata, labels |
| `mono-label` | 10px / 0.625rem | 500 | Section headers, uppercase labels |

---

## Layout

### Grid

- **Max width:** 1640px (centered)
- **Page padding:** 24px (`px-6`)
- **Section spacing:** 24px (`space-y-6`)
- **Card spacing:** 20px (`gap-5`)

### Sidebar Navigation

- **Width:** 260px (fixed)
- **Background:** `#ffffff` (surface)
- **Border:** 1px right border (`outline-variant`)
- **Position:** fixed, left, full height
- **Z-index:** 40
- **Breakpoint:** hidden on mobile, visible on `xl:` (1280px+)

### Top Header

- **Height:** auto (padding-based)
- **Background:** `#ffffff` (surface)
- **Border:** 1px bottom border (`outline-variant`)
- **Position:** sticky, top, z-index: 30
- **Content:** breadcrumbs (left), theme toggle + user info + sign out (right)

---

## Components

### Card

```css
background: #ffffff (surface-container-lowest)
border: 1px solid #e2e8f0
border-radius: 12px
shadow: 0 1px 3px rgba(0,0,0,0.1)
```

- Title in `headline-sm` / `on-surface` / font-weight 600
- Subtitle in `body-sm` / `on-surface-variant`
- Content padding: 20px (`p-5`)

### Badge / Chip

```css
padding: 4px 12px
border-radius: 9999px (full)
font-family: JetBrains Mono
font-size: 12px
font-weight: 500
```

Semantic variants:
- **Approved:** `bg-[#d4edda] text-[#155724]`
- **Review:** `bg-[#fff3cd] text-[#856404]`
- **Rejected:** `bg-[#f8d7da] text-[#721c24]`
- **Default:** `bg-surface-container text-on-surface`

### Stat Card

```css
background: #f1f3f9 (surface-container-low)
border: 1px solid #e2e8f0
border-radius: 12px
padding: 16px
```

- Label: `mono-label` / uppercase / `on-surface-variant`
- Value: `data-metric` / `primary` / font-weight 700
- Icon: 28px circle, `primary-container` background

### Button (Primary)

```css
background: #0051d5 (secondary)
color: #ffffff
padding: 10px 20px
border-radius: 8px
font-weight: 500
```

Hover: darken by 10%. Disabled: opacity 50%.

### Table

```css
font-size: 14px
header: mono-label / uppercase / on-surface-variant / border-bottom
rows: border-bottom outline-variant/40
hover: background surface-container-low
```

---

## Icons

**Library:** Material Symbols Outlined (Google Fonts)

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
```

Usage:
```html
<span class="material-symbols-outlined text-[20px]">dashboard</span>
```

Common icons by section:
- **Navigation:** `dashboard`, `search`, `gavel`, `speed`, `upload_file`, `history`, `analytics`, `monitoring`, `receipt_long`
- **Actions:** `logout`, `light_mode`, `dark_mode`, `chevron_right`
- **Data:** `currency_rupee`, `trending_up`, `verified`, `schedule`, `account_balance`, `error`, `payments`, `pie_chart`
- **Status:** `check_circle`, `warning`, `feedback`

---

## Dark Mode

The design system supports light and dark themes via CSS custom properties. Toggle is available in the top header.

Dark mode overrides:
- `background`: `#0f1118`
- `surface`: `#1a1c1e`
- `on-surface`: `#e3e3e3`
- All color tokens shift to dark variants per MD3 spec

---

## File Reference

| File | Purpose |
|---|---|
| `tailwind.config.js` | All color tokens, font families, spacing, shadows |
| `index.css` | CSS custom properties, utility classes, component styles |
| `index.html` | Google Fonts (Inter, JetBrains Mono) + Material Symbols |
| `components/Layout.tsx` | Sidebar + header implementation |
| `components/UI.tsx` | Card, Badge, Stat, EmptyState, Spinner |
| `components/ScoreGauge.tsx` | Circular score gauge |
| `utils/format.ts` | Score/grade/outcome color maps |

---

## Design References

The `designs/` folder contains 10 HTML design files generated from Google Stitch, one per page. Each folder contains:
- `code.html` — self-contained HTML + CSS reference
- `screen.png` — screenshot of the rendered design

See `README.md` for the full list of design files mapped to pages.
