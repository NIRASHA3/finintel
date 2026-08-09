# OpenAPI Specification (`contracts/openapi`)

## Overview
This directory contains the canonical OpenAPI 3.0 specification representing the complete REST API contract between the Next.js frontend client (`apps/web`) and the Go core API (`services/api`).

## Status
* **Milestone 0**: Blueprint directory established. Formal YAML spec definitions will be populated in **Milestone 1**.

## Planned Work
- Define schema definitions for Organizations, Users, Accounts, Journal Entries, Period Locks, and Audit Logs.
- Auto-generate TypeScript client types for `apps/web` and Go router request/response handlers for `services/api`.
