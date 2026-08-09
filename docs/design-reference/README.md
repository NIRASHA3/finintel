# Design Reference & Tokens Guide

## Purpose
This directory serves as the central repository for UI/UX visual references, design tokens, wireframe assets, and Stitch-generated interface mocks for the FinIntel web application.

---

## Contents Overview

### 1. Stitch Mocks & Screenshots (`docs/design-reference/mocks/`)
- Contains reference screenshots and HTML mocks generated during design exploration using tools like Google Stitch or Figma exports.
- Contains screen inventory diagrams covering key application views (Dashboard, Review Queue, General Ledger, Chart of Accounts, Reports, Audit Trail, Settings).

### 2. Design Tokens (`docs/design-reference/tokens.json`)
- Defines design primitives including color palettes (financial slate, emerald accent, alert red), typography scales (Inter/Roboto), spacing units, border radii, and dark/light theme properties.

### 3. Responsive Design References
- Layout guidelines for Desktop (>= 1280px), Tablet (768px - 1027px), and Mobile (< 768px) views.

---

## Critical Engineering Constraint

> [!CAUTION]
> **PROHIBITION ON DIRECT CODE COPYING**: Generated Stitch HTML, inline CSS, or raw prototype markup MUST NOT be copied directly into production React components in `apps/web`.
>
> All production frontend UI components MUST be built cleanly using Next.js React components, TypeScript interfaces, and Tailwind CSS design tokens following component modularity and accessibility standards (WCAG 2.1 AA).
