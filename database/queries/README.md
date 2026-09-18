# Database Queries (`database/queries`)

## Overview
This directory is reserved for a future `sqlc` migration. The current Go services keep SQL next to their domain services and do not generate query code from this folder.

## Status
* No generated query workflow is currently configured.

## Rules
- Every tenant-scoped query MUST bind and filter organization context, with PostgreSQL RLS used as defense in depth.
- No dynamic raw string SQL concatenation permitted.
