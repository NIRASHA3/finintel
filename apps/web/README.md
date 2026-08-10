# Web Application Client (`apps/web`)

## Overview
`apps/web` contains the Next.js App Router front-end user interface for FinIntel, built using React 19, TypeScript (`strict: true`), and Tailwind CSS.

## Status
* **Milestone 1**: Engineering Foundation established. Application shell, design system tokens, accessible layout landmarks, Vitest unit testing, and pnpm monorepo workspace scripts configured. Domain screens (dashboards, transactions, journal forms) remain deferred to subsequent vertical slice milestones.

## Design Tokens & Styling
Design tokens are implemented in `app/globals.css` and `tailwind.config.ts` adhering to `docs/design-reference/design-system.md`:
* **Colors**: Navy (`#001524`), Teal (`#15616D`), Alert Red (`#BA1A1A`), Surface Light (`#F8F9FA`), Surface Dark (`#0B131F`).
* **Typography**: Inter for UI text, JetBrains Mono / tabular figures (`tnum`) for monetary values.
* **Layout**: 4px grid rhythm, 1440px container max-width, 12px rounded corner radii.

## Development Commands
All commands run from root or package workspace:

```bash
# Run web development server (from root)
pnpm dev:web

# Run linting
pnpm --filter web lint

# Run TypeScript type check
pnpm --filter web type-check

# Run Vitest unit tests
pnpm --filter web test

# Execute production build
pnpm --filter web build
```

## Accessibility (a11y)
* Complies with WCAG 2.2 Level AA accessibility standards.
* Includes landmark HTML elements (`<header>`, `<main>`, `<footer>`, `<nav>`), skip-to-main-content navigation link, and ARIA status attributes.
