# Database Queries (`database/queries`)

## Overview
This directory contains raw SQL query definitions annotated for `sqlc` to generate type-safe Go code for `services/api`.

## Status
* **Milestone 0**: Blueprint directory established. SQL query files will be created in **Milestone 1**.

## Rules
- 100% of queries MUST filter by `WHERE organization_id = $1` to enforce multi-tenant isolation at the query execution level.
- No dynamic raw string SQL concatenation permitted.
