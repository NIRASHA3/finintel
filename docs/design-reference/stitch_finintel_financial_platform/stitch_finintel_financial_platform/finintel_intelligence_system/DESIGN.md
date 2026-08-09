---
name: FinIntel Intelligence System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#43474c'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#73777c'
  outline-variant: '#c3c7cc'
  surface-tint: '#4c6172'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#071d2d'
  on-primary-container: '#728699'
  inverse-primary: '#b4c9dd'
  secondary: '#1e6773'
  on-secondary: '#ffffff'
  secondary-container: '#a8eaf8'
  on-secondary-container: '#246b78'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#311300'
  on-tertiary-container: '#d16500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e5fa'
  primary-fixed-dim: '#b4c9dd'
  on-primary-fixed: '#071d2d'
  on-primary-fixed-variant: '#35495a'
  secondary-fixed: '#abedfb'
  secondary-fixed-dim: '#8fd1de'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e59'
  tertiary-fixed: '#ffdbc8'
  tertiary-fixed-dim: '#ffb689'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#733500'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system is engineered for a high-performance financial intelligence environment. It prioritizes clarity, precision, and trust through a **Modern Enterprise Minimalist** aesthetic. Drawing inspiration from industry leaders like Stripe and Linear, the system utilizes a structured card-based architecture, generous whitespace to reduce cognitive load, and subtle depth to organize complex data. The emotional response is one of institutional stability paired with cutting-edge technological speed.

## Colors
The palette is rooted in a "Deep Navy" primary to establish authority. "Vibrant Orange" is reserved strictly for high-priority call-to-actions and critical focus points to ensure visual "pop" against the professional backdrop.

- **Primary & Neutrals:** Use #001524 for text and primary branding. Use #F8F9FA for page backgrounds and #FFECD1 for subtle section highlighting or "soft" card backgrounds.
- **Data Visualization:** Use #15616D (Teal) and #78290F (Deep Maroon) for multi-series charts to provide sophisticated contrast.
- **Accessibility:** Ensure all text-on-background combinations meet WCAG AA standards. Orange CTAs should use white text only if the contrast ratio permits; otherwise, use the Deep Navy for text on light accents.

## Typography
This design system utilizes **Inter** for all UI elements to maintain a clean, neo-grotesque feel. 

- **Financial Figures:** All currency, percentages, and data points in tables must use **JetBrains Mono** or Inter with `tnum` (tabular figures) enabled to ensure vertical alignment of digits.
- **Hierarchy:** Use tight letter-spacing on larger headings to create a premium, "tucked" look.
- **Scale:** Maintain a clear distinction between body-md (default reading) and body-sm (meta-data and captions).

## Layout & Spacing
The system employs a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Rhythm:** All spacing must be multiples of 4px. 
- **Containers:** Max-width for dashboard content is 1440px. 
- **Density:** Use 16px (md) padding for standard cards and 12px (sm) for high-density data views. Large marketing or "Hero" sections should utilize 48px (2xl) vertical rhythm.

## Elevation & Depth
Depth is conveyed through **Ambient Shadows** and tonal layering. This system avoids harsh borders in favor of soft, multi-layered shadows that mimic natural light.

- **Level 0 (Base):** Page background (#F8F9FA).
- **Level 1 (Cards):** White background (#FFFFFF) with a 1px border in a light neutral (opacity 5%) and a subtle shadow: `0px 1px 3px rgba(0,0,0,0.05), 0px 10px 15px -5px rgba(0,0,0,0.03)`.
- **Level 2 (Dropdowns/Modals):** Increased shadow spread and a slight backdrop blur (8px) to separate the element from the data below.
- **Interactive:** Elements should lift slightly on hover (shadow intensity increases) to provide tactile feedback.

## Shapes
The design system standardizes on a **12px (0.75rem)** corner radius for all primary containers and cards.

- **Small Components:** Buttons and Input fields should use 8px (0.5rem) to appear more precise.
- **Large Components:** Modals and large dashboard sections use 16px (1rem).
- **Data Points:** Tooltips and small badges use 4px (0.25rem).

## Components

### Buttons
- **Primary:** Background #FF7D00, Text #FFFFFF. Bold, sans-serif.
- **Secondary:** Background #001524, Text #FFFFFF.
- **Ghost:** No background, #15616D Border 1px or Text only.
- **States:** 10% black overlay on hover; 20% black overlay on active.

### Inputs
- **Default:** 1px border #E2E8F0, 8px radius, Inter 14px.
- **Focus:** 1px border #15616D with a 3px outer glow (Teal at 20% opacity).

### Data Tables
- **Header:** Light grey background (#F1F5F9), 12px Uppercase labels.
- **Rows:** 48px height, 1px bottom border (#F1F5F9).
- **Cells:** Use Tabular Figures for all numbers. Right-align numeric columns.

### Charts
- **Line/Bar:** Use Teal (#15616D) for primary trends. Use a 2px stroke width for lines. Fill areas with a 10% opacity gradient of the stroke color.

### Feedback States
- **Skeletons:** Use a subtle pulse animation on a #F1F5F9 background.
- **Toasts:** Positioned top-right. Success uses a green left-border; Error uses a maroon left-border.
- **Empty States:** Centered illustrative icons in Deep Navy (20% opacity) with a clear Primary CTA button.