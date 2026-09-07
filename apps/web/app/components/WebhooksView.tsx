"use client";

import React, { useState, useEffect } from "react";
import { fetchWebhookSubscriptions, createWebhookSubscription, deleteWebhookSubscription, WebhookSubscription } from "../../lib/api-client";

interface WebhooksViewProps {
  organizationId: string;
}

export const WebhooksView: React.FC<WebhooksViewProps> = ({ organizationId }) => {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const subs = await fetchWebhookSubscriptions(organizationId);
      setSubscriptions(subs);
    } catch (err: any) {
      setError(err.message || "Failed to load webhook subscriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [organizationId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await createWebhookSubscription(organizationId, targetUrl.trim(), ["period.closed", "anomaly.detected", "reversal.posted"]);
      setTargetUrl("");
      await loadSubscriptions();
    } catch (err: any) {
      setError(err.message || "Failed to register webhook subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookSubscription(organizationId, id);
      await loadSubscriptions();
    } catch (err: any) {
      setError(err.message || "Failed to delete webhook subscription.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Real-Time Webhook Engine</h2>
        <p className="text-sm text-slate-500 mt-1">
          Subscribe external endpoints to critical financial events. Payload signatures are signed using HMAC-SHA256.
        </p>

        <form onSubmit={handleCreate} className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            placeholder="https://api.yourcompany.com/events/finintel"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            required
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Add Endpoint"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">Active Webhook Subscriptions</h3>
          <span className="text-xs text-slate-500 font-medium">{subscriptions.length} Subscriptions</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading webhooks...</div>
        ) : subscriptions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">No webhook endpoints registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-medium">
                  <th className="py-3.5 px-4">Target URL</th>
                  <th className="py-3.5 px-4">HMAC Secret Token</th>
                  <th className="py-3.5 px-4">Subscribed Events</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900">{sub.target_url}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{sub.secret_token ? `${sub.secret_token.slice(0, 10)}...` : "••••••••"}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.events.map((ev, i) => (
                          <span key={i} className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold">Active</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
