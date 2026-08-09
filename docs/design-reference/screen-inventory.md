# Screen Inventory & Visual Asset Index

> [!NOTE]
> **DEMO DATA NOTICE**: All screenshots and visual assets referenced in this inventory represent mock/demo data and interface layouts generated during design exploration. They do not represent live production data, customer claims, SOC 2 compliance certifications, or real accuracy figures.

## Overview
This screen inventory details the visual reference screenshots retained in `docs/design-reference/screenshots/`. These assets serve as design guidance for responsive layout structures, component placement, and visual hierarchy.

---

## Desktop Screen References (1440px Viewport Target)

| Asset File Name | Screen Name & Purpose | Primary Components | Mock Data Label |
|---|---|---|---|
| `landing_page.png` | Marketing & Product Overview | Hero section, feature breakdown, CTA | Mock / Demo Layout |
| `sign_in.png` | Identity & Sign-In Interface | OIDC redirect trigger, organization selector mockup | Mock / Demo Layout |
| `onboarding_setup.png` | Organization Onboarding Wizard | Currency selection, fiscal year setup, COA template selection | Mock / Demo Layout |
| `dashboard.png` | Executive Financial Dashboard | Financial health summary cards, cash runway chart, recent activity | Mock / Demo Layout |
| `transactions.png` | Transaction Import & Review Queue | Staged transaction table, category suggestion badges, review actions | Mock / Demo Layout |
| `general_ledger.png` | General Ledger & Journal Entries | Immutable entry list, debit/credit balance validator form | Mock / Demo Layout |
| `financial_reports.png` | Financial Statement Reports | Income statement, balance sheet, trial balance tabs | Mock / Demo Layout |
| `analytics.png` | Financial Intelligence & Analytics | Predictive cash flow charts, expense trends | Mock / Demo Layout |
| `ai_intelligence_center.png` | Anomaly Detection & AI Suggestions | Anomaly queue, explanation drawer, confidence score badges | Mock / Demo Layout |
| `scenario_planning.png` | What-If Forecasting & Scenario Builder | Scenario adjustment sliders, runway impact comparison | Mock / Demo Layout |
| `settings.png` | Organization Settings & Members | Role permission matrix, member invite modal, audit log viewer | Mock / Demo Layout |

---

## Mobile Screen References (375px - 414px Mobile Viewport)

| Asset File Name | Screen Name & Purpose | Primary Mobile Adaptations | Mock Data Label |
|---|---|---|---|
| `dashboard_mobile.png` | Mobile Executive Overview | Collapsed navigation, stacked KPI cards, compact charts | Mock / Demo Layout |
| `transactions_mobile.png` | Mobile Transaction Review | Swipeable review cards, quick category buttons | Mock / Demo Layout |
| `financial_reports_mobile.png` | Mobile Report Inspector | Scrollable statement tables, high-density summary blocks | Mock / Demo Layout |
| `ai_intelligence_mobile.png` | Mobile Anomaly Alert Queue | Mobile push-style alert cards, inline approval actions | Mock / Demo Layout |

---

## Critical Engineering Constraints

> [!CAUTION]
> 1. **Zero Direct Code Copying**: Generated HTML prototype files have been removed. All production components in `apps/web` MUST be implemented using clean React, TypeScript, and Tailwind CSS.
> 2. **No False Claims**: Screenshots containing mock badges, sample SOC 2 icons, or dummy customer testimonials MUST NOT be presented as actual certifications or claims.
