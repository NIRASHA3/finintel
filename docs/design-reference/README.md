# Design Reference & Tokens Guide

## Purpose
This directory serves as the central repository for UI/UX visual references, design tokens, wireframe assets, and design system guidelines for the FinIntel web application.

> [!NOTE]
> **DEMO DATA NOTICE**: All screenshot references in `screenshots/` contain mock/demo data for visual layout guidance only. No screenshots or mock files represent live production data, customer claims, SOC 2 compliance certifications, or real accuracy figures.

---

## Directory Structure

```
docs/design-reference/
├── README.md             # Index and architectural guidelines
├── design-system.md      # Design tokens, color palette, typography scale, spacing
├── screen-inventory.md   # Detailed inventory of desktop and mobile screen mocks
└── screenshots/          # Flat PNG screenshot references (Mock / Demo layout data)
    ├── ai_intelligence_center.png
    ├── ai_intelligence_mobile.png
    ├── analytics.png
    ├── dashboard.png
    ├── dashboard_mobile.png
    ├── financial_reports.png
    ├── financial_reports_mobile.png
    ├── general_ledger.png
    ├── landing_page.png
    ├── onboarding_setup.png
    ├── scenario_planning.png
    ├── settings.png
    ├── sign_in.png
    ├── transactions.png
    └── transactions_mobile.png
```

---

## Contents Summary

### 1. Design System Specification ([design-system.md](file:///d:/Finacial_Project/finintel/docs/design-reference/design-system.md))
- Defines color tokens (surface, primary navy `#001524`, secondary teal `#15616D`, alert red `#BA1A1A`).
- Defines typography scale using **Inter** for UI text and **JetBrains Mono** / tabular figures (`tnum`) for all monetary values.
- Defines elevation, depth, 12-column fluid grid standards, and 12px container corner radii.

### 2. Screen Inventory ([screen-inventory.md](file:///d:/Finacial_Project/finintel/docs/design-reference/screen-inventory.md))
- Maps visual screenshots to specific functional application views for desktop and mobile viewports.

---

## Critical Engineering Constraint

> [!CAUTION]
> **PROHIBITION ON DIRECT CODE COPYING**: All generated HTML prototype files have been permanently removed. Production React components in `apps/web` MUST be built cleanly using Next.js, TypeScript interfaces, and Tailwind CSS following component modularity and WCAG 2.2 AA accessibility standards.
