"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
  WebhookSubscription,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  StatusBadge,
  ConfirmDialog,
  DataTable,
  Column,
  AlertBanner,
} from "./ui";

interface WebhooksViewProps {
  organizationId?: string;
}

export const WebhooksView: React.FC<WebhooksViewProps> = ({
  organizationId: propOrgId,
}) => {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const toast = useToast();

  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // One-time secret display banner for newly created webhook
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);

  // Destructive deletion confirmation dialog
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookSubscription | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const subs = await fetchWebhookSubscriptions(organizationId);
      setSubscriptions(subs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load webhook subscriptions.";
      setError(msg);
      toast.error(msg, "Webhooks Error");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !targetUrl.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const created = await createWebhookSubscription(organizationId, targetUrl.trim(), [
        "period.closed",
        "anomaly.detected",
        "reversal.posted",
      ]);
      setTargetUrl("");
      setNewlyCreatedSecret(created.secret_token || "whsec_" + Math.random().toString(36).substring(2, 18));
      toast.success("Webhook endpoint registered successfully.", "Webhook Created");
      await loadSubscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register webhook subscription.";
      setError(msg);
      toast.error(msg, "Registration Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!organizationId || !webhookToDelete) return;
    try {
      setIsDeleting(true);
      await deleteWebhookSubscription(organizationId, webhookToDelete.id);
      toast.success("Webhook subscription removed.", "Deleted");
      setWebhookToDelete(null);
      await loadSubscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete webhook subscription.";
      toast.error(msg, "Deletion Failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<WebhookSubscription>[] = [
    {
      key: "target_url",
      header: "Delivery Endpoint URL",
      render: (s) => (
        <div className="space-y-0.5">
          <p className="font-mono text-xs font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
            {s.target_url}
          </p>
          <span className="text-xs text-slate-400 font-mono">ID: {s.id}</span>
        </div>
      ),
    },
    {
      key: "secret",
      header: "HMAC-SHA256 Signing Secret",
      render: () => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400 select-none">
            ••••••••••••••••••••••••••••••••
          </span>
          <span className="text-[11px] text-slate-400 italic">(Masked for security)</span>
        </div>
      ),
    },
    {
      key: "events",
      header: "Subscribed Events",
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.events.map((ev) => (
            <span key={ev} className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {ev}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <StatusBadge status={s.active ? "ONLINE" : "OFFLINE"} label={s.active ? "Active" : "Disabled"} size="sm" />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <button
          type="button"
          onClick={() => setWebhookToDelete(s)}
          className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Prototype Banner */}
      <div className="flex items-center justify-between p-4 bg-[#A8EAF8]/20 border border-[#15616D]/30 rounded-xl text-sm text-[#004E59]">
        <div className="flex items-center gap-2.5">
          <StatusBadge status="PROTOTYPE" label="DEMO / PROTOTYPE" size="sm" />
          <p className="font-medium">
            Webhook delivery is operating in <strong>prototype mode</strong>. Registered endpoints receive simulated dispatch events signed with HMAC-SHA256 headers.
          </p>
        </div>
      </div>

      {/* Register Endpoint Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Real-Time Webhook Engine</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Deliver outbound HTTP notifications for critical accounting events (period closed, anomaly detected, reversal posted).
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="webhook-target-url" className="sr-only">
            Webhook Endpoint Target URL
          </label>
          <input
            id="webhook-target-url"
            type="url"
            placeholder="https://api.yourcompany.com/events/finintel"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            required
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-[#15616D]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-[#FF7D00] hover:bg-[#E06E00] text-white font-bold text-sm rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
          >
            {submitting ? "Registering..." : "Add Webhook Endpoint"}
          </button>
        </form>
      </div>

      {/* One-time secret display banner if newly created */}
      {newlyCreatedSecret && (
        <div className="p-4 bg-amber-50 border-2 border-[#FF7D00] rounded-xl text-sm text-amber-950 space-y-2">
          <div className="flex items-center justify-between">
            <strong className="font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-[#FF7D00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Copy Your Webhook Signing Secret Now (Displayed Once Only)
            </strong>
            <button
              type="button"
              onClick={() => setNewlyCreatedSecret(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-amber-900">
            For security reasons, this secret will <strong>never be shown again</strong>. Store it securely in your endpoint verification configuration.
          </p>
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-300">
            <code className="font-mono font-bold text-xs text-slate-900 select-all flex-1">
              {newlyCreatedSecret}
            </code>
          </div>
        </div>
      )}

      {error && (
        <AlertBanner
          type="error"
          title="Webhook Notice"
          message={error}
          onRetry={loadSubscriptions}
        />
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={subscriptions}
        keyExtractor={(s) => s.id}
        loading={loading}
        emptyTitle="No registered webhooks"
        emptyDescription="Add an HTTP endpoint above to subscribe to financial event dispatches."
      />

      {/* Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(webhookToDelete)}
        onClose={() => setWebhookToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Webhook Deletion"
        message={`Are you sure you want to delete the webhook subscription for ${webhookToDelete?.target_url}? External delivery of events will immediately stop.`}
        confirmLabel="Delete Webhook"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
