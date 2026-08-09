# Database Migrations (`database/migrations`)

## Overview
This directory stores sequential SQL schema migration scripts executed via a migration runner (e.g. `golang-migrate` or `pressly/goose`).

## Status
* **Milestone 0**: Blueprint directory established. Migration scripts will be created in **Milestone 1**.

## Rules
- Every migration file must have matching `up.sql` and `down.sql` steps.
- Every business table creation script MUST include an `organization_id UUID NOT NULL` column with foreign key constraint referencing `organizations(id)`.
