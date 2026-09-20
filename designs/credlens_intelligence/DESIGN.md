---
name: CredLens Intelligence
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#003120'
  on-tertiary: '#ffffff'
  tertiary-container: '#004a32'
  on-tertiary-container: '#4ac08f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-caption:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-sm: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system embodies an institutional, high-trust fintech aesthetic tailored for credit underwriters, risk officers, and institutional lenders evaluating MSME portfolios. 

- **Personality:** Authoritative, razor-sharp, analytical, and objective. It projects the institutional gravitas of a tier-one terminal combined with modern AI clarity.
- **Target Audience:** Underwriters, Chief Risk Officers (CROs), credit analysts at NBFCs, commercial banks, and private credit funds making multi-million dollar underwriting decisions under tight SLAs.
- **Design Style:** Modern Institutional Minimalism with Precision Data Density. It relies on crisp slate surfaces, sharp hairline borders, disciplined whitespace, deliberate typographic hierarchy, and prominent semantic risk indicators that guide attention instantly without visual fatigue.

## Colors
The palette balances institutional calm with unmistakable functional semantics:

- **Primary Canvas & Surfaces:** Pure `#FFFFFF` card layers resting on an ultra-subtle off-white application canvas `#F8FAFC`.
- **Core Navy & Royal Blue:** `#1E3A8A` (Deep Navy) anchors navigation, master branding, and authoritative section headers. `#2563EB` (Royal Blue) drives primary CTAs, active filters, and interactive intelligence triggers (e.g., "Run Model", "Extract Bank Statements").
- **Structural Neutrals:** Borders, dividers, and table rules strictly utilize `#E2E8F0` (standard) and `#F1F5F9` (recessed/subtle). Text neutrals leverage `#0F172A` for primary readouts, `#334155` for secondary data labels, and `#64748B` for tertiary captions.
- **Semantic Risk Triad:** 
  - **Grade A / Safe:** `#059669` (Emerald) with soft tint `#ECFDF5` for instant approvals, low PD (Probability of Default), and verified tax reconciliations.
  - **Grade B / Watchlist:** `#D97706` (Amber) with soft tint `#FFFBEB` for debt-service warnings, seasonal spikes, or missing filings.
  - **Grade C / High Risk:** `#DC2626` (Rose) with soft tint `#FEF2F2` for circular trading signals, GST mismatch anomalies, and hard rejections.

## Typography
Typographic clarity is essential for rapid, error-free financial underwriting:

- **Primary Typeface:** `Inter` handles all structural headlines and dense interface labels. Its neutral geometry and tall x-height provide exceptional legibility across dense dashboard grids.
- **Tabular Numerics:** All instances of currency, GSTINs, CIBIL/Experian credit scores, loan amounts, and balance sheet tables must enforce CSS `font-feature-settings: "tnum" 1` to ensure strict vertical columnar alignment.
- **Code & Identifier Typeface:** `JetBrains Mono` is reserved exclusively for ledger IDs, GSTINs, PAN hashes, entity registration keys, and audit trail timestamps to visually distinguish technical metadata from narrative intelligence.

## Layout & Spacing
The layout follows a 12-column responsive fluid grid configured for high-density, multi-pane financial displays:

- **Desktop (1280px+):** Fixed 260px left sidebar navigation, followed by a 12-column grid with `1.25rem` (20px) gutters and `1.5rem` (24px) outer page margins. Workspaces can expand dynamically to 1600px for panoramic multi-period cash-flow analysis.
- **Tablet (768px - 1279px):** Collapses navigation into a compact rail (64px width). 8-column layout with `1rem` (16px) gutters. Complex comparison tables switch to horizontal pan with sticky entity headers.
- **Mobile (<768px):** Single-column stack with `1rem` (16px) outer canvas margins. Multi-metric summary cards convert into swipeable carousel strips, preserving tabular data integrity via vertical modal sheets.

## Elevation & Depth
Depth is articulated primarily through crisp structural borders (`#E2E8F0`) and subtle, low-diffusion ambient shadows that preserve interface lightness:

- **Level 0 (Base Canvas):** Background tone `#F8FAFC`, zero shadow.
- **Level 1 (Card & Table Surface):** Solid `#FFFFFF` surface, enclosed in a 1px solid `#E2E8F0` border. Shadow: `0px 1px 2px 0px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Hovered Card / Active Metric Panel):** Shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.06), 0px 2px 4px -2px rgba(15, 23, 42, 0.04)`, 1px border colored `#CBD5E1`.
- **Level 3 (Flyout Drawer / Filter Menu / Tooltip):** Shadow: `0px 10px 15px -3px rgba(15, 23, 42, 0.08), 0px 4px 6px -4px rgba(15, 23, 42, 0.03)`, border `#CBD5E1`.
- **Level 4 (Underwriting Approval Modal):** Dimmer backdrop `rgba(15, 23, 42, 0.45)` with 4px backdrop blur, elevated modal container with shadow `0px 20px 25px -5px rgba(15, 23, 42, 0.1)`.

## Shapes
A disciplined, soft-cornered geometry (Level 1) conveys institutional precision:

- **Base Radius (4px / 0.25rem):** Standard interactive elements such as primary/secondary buttons, text input fields, table filter selects, and micro metric pills.
- **Medium Radius (8px / 0.5rem):** Underwriting cards, financial summary modules, risk gauge wrappers, and data grid panels.
- **Large Radius (12px / 0.75rem):** Primary application dialogs, approval summary drawers, and master flyout containers.
- **Pill (Fully Rounded):** Restricted strictly to circular score dials, risk tier badges (e.g., `Low Risk`), and live processing status chips.

## Components

### Buttons
- **Primary Action (Intelligence Triggers):** Deep navy `#1E3A8A` background with crisp white typography, 4px corner radius, height 36px (dense) or 40px (standard). Hover state transitions to `#172554`.
- **Secondary CTA:** Pure white background, 1px solid border `#CBD5E1`, text `#334155`. Hover state elevates with subtle surface tint `#F8FAFC`.
- **Destructive/Reject Action:** Border 1px solid `#FECACA`, text `#DC2626`, background `#FEF2F2`. Hover deepens to `#FEE2E2`.

### Metric Badges & Status Chips
- Height of 22px with 9999px radius. Monospace or semi-bold labels at 11px font size.
- **Approve / Grade A:** Background `#ECFDF5`, text `#047857`, border 1px solid `#A7F3D0`.
- **Review / Grade B:** Background `#FFFBEB`, text `#B45309`, border 1px solid `#FDE68A`.
- **Red Flag / Grade C:** Background `#FEF2F2`, text `#B91C1C`, border 1px solid `#FECACA`.

### Data Tables & Ledger Grids
- **Header:** Height 36px, background `#F8FAFC`, uppercase 11px text `#64748B`, bottom border 1px solid `#E2E8F0`.
- **Rows:** Height 44px, alternating zebra striping avoided in favor of 1px solid `#F1F5F9` row dividers. Hover row state triggers `#F8FAFC`.
- **Numeric Cells:** Tabular numerals, right-aligned with monospace formatting for amounts and percentages.

### Score Gauges & Credit Indicators
- Circular ring gauges utilizing dual stroke layers: a background track in `#E2E8F0` and a front stroke mapped dynamically to semantic colors (Emerald, Amber, or Rose) based on composite DSCR, banking turnover, and bureau score computations.

### Form Inputs
- Height 38px, background `#FFFFFF`, border 1px solid `#CBD5E1`, text `#0F172A`. Focused state exhibits a 2px outer ring in `#2563EB` at 20% opacity with border color shifting to `#2563EB`.

### Cards & Intelligence Panels
- Enclosed with 1px border `#E2E8F0`, 8px corner radius, padding `1.25rem`. Headers include an icon badge, title in `headline-sm`, and an optional right-aligned metadata tag.