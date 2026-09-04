"use client";

import React, { useState, useEffect } from "react";
import { fetchAuditLogs, AuditLog, Organization } from "../../lib/api-client";

interface AuditTrailViewProps {
  organization: Organization;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ organization }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(organization.id, 100);
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [organization.id]);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter === "ALL") return true;
    return log.action === actionFilter;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "POST":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">POST</span>;
      case "LOCK":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">LOCK</span>;
      case "CLOSE":
      case "UPDATE":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">{action}</span>;
      case "CREATE":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">CREATE</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900">Atomic Audit Trail</h3>
          <p className="text-xs text-slate-500">Append-only compliance log of accounting and security operations</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600 font-semibold">Filter Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
          >
            <option value="ALL">All Actions</option>
            <option value="POST">POST</option>
            <option value="LOCK">LOCK</option>
            <option value="CLOSE">CLOSE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="CREATE">CREATE</option>
          </select>

          <button
            onClick={loadLogs}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-medium animate-pulse rounded-2xl bg-white border border-slate-200 shadow-sm">
          Loading audit trail records...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-slate-900 text-sm font-bold">No audit log records found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity Type</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Correlation ID</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-3.5 text-slate-600 font-medium">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3.5 font-sans">{getActionBadge(log.action)}</td>
                      <td className="p-3.5 text-indigo-700 font-bold">{log.entityType}</td>
                      <td className="p-3.5 font-sans text-slate-900 font-medium">
                        {log.actorFullName || log.actorEmail || log.actorType}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">{log.correlationId}</td>
                      <td className="p-3.5 text-right font-sans">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                        >
                          {isExpanded ? "Hide JSON" : "View JSON"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={6} className="p-4">
                          <div className="text-[11px] font-mono text-slate-100 bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-x-auto shadow-inner">
                            <span className="text-slate-400 block mb-1 text-[10px] uppercase font-bold">Audit Payload Diff:</span>
                            <pre className="text-emerald-400 whitespace-pre-wrap">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
