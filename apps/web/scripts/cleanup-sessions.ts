#!/usr/bin/env node
// Scheduled Cron/Maintenance Script: Cleanup Expired BFF Sessions
// Usage:
//   npx tsx scripts/cleanup-sessions.ts
//
// Scheduled in crontab or container orchestrator (e.g., every 15 minutes):
//   */15 * * * * cd /app && pnpm run cleanup-sessions

import { cleanupExpiredBFFSessions, getBffPool } from "../lib/auth/session";

async function main() {
  console.log(`[${new Date().toISOString()}] Starting cleanup of expired and revoked BFF sessions...`);
  try {
    const deletedCount = await cleanupExpiredBFFSessions(5000);
    console.log(`[${new Date().toISOString()}] Successfully pruned ${deletedCount} expired/revoked session(s).`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error during session cleanup:`, err);
    process.exit(1);
  } finally {
    const pool = getBffPool();
    await pool.end().catch(() => {});
  }
}

main();
