"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchAuditLogs, AuditLog, Organization } from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  DataTable,
  Column,
  AlertBanner,
  EmptyState,
} from "./ui";

interface AuditTrailViewProps {
  organization?: Organization;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  organization: propOrg,
}) => {
  const { activeOrg } = useOrganization();
  const organization = propOrg || activeOrg;
  const toast = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const loadLogs = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogs(organization.id, 100);
      setLogs(res.auditLogs);
      setNextCursor(res.nextCursor || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load audit logs";
      setError(msg);
      toast.error(msg, "Audit Trail Load Failed");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, toast]);

  const handleLoadMore = async () => {
    if (!organization?.id || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchAuditLogs(organization.id, 100, nextCursor);
      setLogs((prev) => [...prev, ...res.auditLogs]);
      setNextCursor(res.nextCursor || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load additional audit logs";
      toast.error(msg, "Pagination Error");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter === "ALL") return true;
    return log.action === actionFilter;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "POST":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "LOCK":
        return "bg-rose-50 text-[#BA1A1A] border-rose-300";
      case "CLOSE":
      case "UPDATE":
        return "bg-amber-50 text-amber-900 border-amber-300";
      case "CREATE":
        return "bg-indigo-50 text-indigo-900 border-indigo-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Select an organization to inspect its compliance audit trail."
      />
    );
  }

  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: "Timestamp (UTC)",
      render: (log) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {new Date(log.createdAt).toISOString().replace("T", " ").substring(0, 19)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getActionBadge(log.action)}`}>
          {log.action}
        </span>
      ),
    },
    {
      key: "target",
      header: "Entity Target",
      render: (log) => (
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-900 block">{log.entityType}</span>
          <span className="font-mono text-xs text-slate-400 block truncate max-w-[200px]">ID: {log.entityId}</span>
        </div>
      ),
    },
    {
      key: "user",
      header: "Invoking Actor",
      render: (log) => (
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-800 block">
            {log.actorFullName || log.actorEmail || `Actor: ${log.actorId?.substring(0, 8) || "System"}`}
          </span>
          <span className="font-mono text-xs text-slate-400 block truncate max-w-[160px]">
            Corr: {log.correlationId ? log.correlationId.substring(0, 12) : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "details",
      header: "Payload",
      align: "right",
      render: (log) => (
        <button
          type="button"
          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
          className="text-xs font-bold text-[#15616D] hover:underline"
        >
          {expandedLogId === log.id ? "Hide JSON" : "Inspect"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Atomic Audit Trail</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Append-only, cryptographically verified record of system actions, journal posts, and state transitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="audit-filter-action" className="text-xs text-slate-600 font-semibold">
            Action:
          </label>
          <select
            id="audit-filter-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 min-h-[36px]"
          >
            <option value="ALL">All Actions</option>
            <option value="POST">POST</option>
            <option value="LOCK">LOCK</option>
            <option value="CLOSE">CLOSE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="CREATE">CREATE</option>
          </select>

          <button
            type="button"
            onClick={loadLogs}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition min-h-[36px]"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <AlertBanner
          type="error"
          title="Audit Trail Error"
          message={error}
          onRetry={loadLogs}
        />
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        keyExtractor={(l) => l.id}
        loading={loading}
        emptyTitle="No audit records"
        emptyDescription="No events matching the selected filter have been recorded in the audit log."
      />

      {/* Expanded payload details inspector */}
      {expandedLogId && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto shadow-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
            <span>Audit Entry ID: {expandedLogId}</span>
            <button
              type="button"
              onClick={() => setExpandedLogId(null)}
              className="hover:text-white"
            >
              Close
            </button>
          </div>
          <pre>
            {JSON.stringify(
              logs.find((l) => l.id === expandedLogId)?.changes || {},
              null,
              2
            )}
          </pre>
        </div>
      )}

      {nextCursor && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition min-h-[44px] disabled:opacity-50"
          >
            {loadingMore ? "Loading older logs..." : "Load Older Logs"}
          </button>
        </div>
      )}
    </div>
  );
};
