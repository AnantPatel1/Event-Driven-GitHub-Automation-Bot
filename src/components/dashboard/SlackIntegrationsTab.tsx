"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Send,
  ShieldCheck,
  HelpCircle,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import type {
  SlackIntegrationItem,
  TestSlackResult,
  RepositoryItem,
} from "@github-bot/shared";
import { apiFetch } from "../../lib/api";

interface SlackIntegrationsTabProps {
  connectedRepos: RepositoryItem[];
  showSlackWarning?: boolean;
  onStatusMessage: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
  onIntegrationsLoaded?: (integrations: SlackIntegrationItem[]) => void;
}

export function SlackIntegrationsTab({
  connectedRepos,
  showSlackWarning,
  onStatusMessage,
  onIntegrationsLoaded,
}: SlackIntegrationsTabProps) {
  const [integrations, setIntegrations] = useState<SlackIntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form states
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackTargetRepoId, setSlackTargetRepoId] = useState("default");
  const [slackChannelName, setSlackChannelName] = useState("");
  const [slackTestResult, setSlackTestResult] = useState<TestSlackResult | null>(null);

  const fetchSlackIntegrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ integrations: SlackIntegrationItem[] }>(
        "/integrations/slack"
      );
      if (res.ok && res.data) {
        const items = res.data.integrations || [];
        setIntegrations(items);
        onIntegrationsLoaded?.(items);
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Failed to load Slack integrations.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onIntegrationsLoaded, onStatusMessage]);

  // Fetch ONLY when mounted/active!
  useEffect(() => {
    fetchSlackIntegrations();
  }, [fetchSlackIntegrations]);

  // Test Slack Webhook
  const handleTestSlack = async (integrationId?: string, rawUrl?: string) => {
    setIsTestingSlack(true);
    setSlackTestResult(null);
    onStatusMessage(null);
    try {
      const res = await apiFetch<TestSlackResult>("/integrations/slack/test", {
        method: "POST",
        body: JSON.stringify({
          integrationId,
          webhookUrl: rawUrl,
        }),
      });

      if (res.ok && res.data) {
        setSlackTestResult(res.data);
        if (res.data.success) {
          onStatusMessage({
            type: "success",
            text: "Test notification dispatched to Slack channel successfully!",
          });
        } else {
          onStatusMessage({
            type: "error",
            text: res.data.message || "Slack returned an error during webhook delivery",
          });
        }
      } else {
        onStatusMessage({
          type: "error",
          text: (res.data as any)?.error || "Failed to dispatch test notification",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error communicating with Slack test service",
      });
    } finally {
      setIsTestingSlack(false);
    }
  };

  // Save or update Slack integration
  const handleSaveSlack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slackWebhookUrl.trim()) return;

    onStatusMessage(null);
    try {
      const res = await apiFetch("/integrations/slack", {
        method: "POST",
        body: JSON.stringify({
          webhookUrl: slackWebhookUrl.trim(),
          repositoryId:
            slackTargetRepoId === "default" ? null : slackTargetRepoId,
          channelName: slackChannelName.trim() || null,
        }),
      });

      if (res.ok) {
        onStatusMessage({
          type: "success",
          text: "Slack webhook stored and encrypted (AES-256-GCM) successfully.",
        });
        setSlackWebhookUrl("");
        setSlackChannelName("");
        await fetchSlackIntegrations();
      } else {
        onStatusMessage({
          type: "error",
          text: res.data?.error || "Failed to save Slack webhook configuration",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error saving Slack configuration",
      });
    }
  };

  // Delete Slack integration
  const handleDeleteSlack = async (integrationId: string) => {
    if (!window.confirm("Remove this Slack webhook integration?")) return;
    setActionLoadingId(integrationId);
    onStatusMessage(null);
    try {
      const res = await apiFetch(`/integrations/slack/${integrationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onStatusMessage({
          type: "warning",
          text: "Slack webhook removed from workspace.",
        });
        await fetchSlackIntegrations();
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to delete Slack integration",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#d0d7de]">
        <div>
          <h3 className="text-sm font-bold text-[#1f2328] font-mono uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#0969da]" />
            Slack Incoming Webhooks
          </h3>
          <p className="text-xs text-[#656d76] mt-0.5">
            Configure per-user or per-repository Slack webhooks. Webhooks are
            encrypted with AES-256-GCM at rest.
          </p>
        </div>
      </div>

      {/* Warning banner if rules need Slack */}
      {showSlackWarning && (
        <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              One or more active triage rules require a Slack channel alert, but
              no webhook has been connected yet.
            </span>
          </div>
        </div>
      )}

      {/* Test result banner */}
      {slackTestResult && (
        <div
          className={`p-3.5 rounded-md text-xs border ${
            slackTestResult.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              {slackTestResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              )}
              <span>
                {slackTestResult.success
                  ? "Slack Delivery Successful (HTTP 200)"
                  : "Slack Delivery Failed"}
              </span>
            </div>
          </div>
          {slackTestResult.message && (
            <p className="mt-1 font-mono text-[11px]">{slackTestResult.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Connect Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="panel rounded-md p-5 space-y-4 bg-white border border-[#d0d7de]">
            <span className="text-xs font-bold text-[#1f2328] font-mono uppercase tracking-wider block">
              Connect or Update Webhook
            </span>

            <form onSubmit={handleSaveSlack} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#1f2328] font-medium">Webhook Scope</label>
                <select
                  value={slackTargetRepoId}
                  onChange={(e) => setSlackTargetRepoId(e.target.value)}
                  className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                >
                  <option value="default">
                    Default (All connected repositories)
                  </option>
                  {connectedRepos.map((r) => (
                    <option key={r.id} value={r.id}>
                      Repository: {r.fullName}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#656d76]">
                  Repository-scoped webhooks override the workspace default when
                  matching rule actions fire.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[#1f2328] font-medium">
                  Channel Name (Optional Reference)
                </label>
                <input
                  type="text"
                  value={slackChannelName}
                  onChange={(e) => setSlackChannelName(e.target.value)}
                  placeholder="e.g. #dev-triage or #security-alerts"
                  className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#1f2328] font-medium">
                  Slack Incoming Webhook URL
                </label>
                <input
                  type="url"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                  required
                />
                <p className="text-[11px] text-[#656d76]">
                  Must point directly to{" "}
                  <code className="text-[#0969da] font-mono">
                    hooks.slack.com
                  </code>
                  . Arbitrary outbound endpoints are blocked.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTestSlack(undefined, slackWebhookUrl)}
                  disabled={isTestingSlack || !slackWebhookUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-white border border-[#d0d7de] hover:bg-[#f3f4f6] text-[#1f2328] text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Send
                    className={`h-3 w-3 ${isTestingSlack ? "animate-spin" : ""}`}
                  />
                  <span>Test URL</span>
                </button>

                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Save & Encrypt</span>
                </button>
              </div>
            </form>
          </div>

          <div className="panel rounded-md p-4 space-y-2 text-xs bg-white border border-[#d0d7de]">
            <div className="flex items-center gap-2 text-[#1f2328] font-semibold font-mono uppercase text-[11px]">
              <HelpCircle className="h-3.5 w-3.5 text-[#0969da]" />
              Generating your Slack Webhook URL
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[#656d76] text-[11px] leading-relaxed">
              <li>
                Go to{" "}
                <strong className="text-[#1f2328]">api.slack.com/apps</strong> in
                your browser.
              </li>
              <li>
                Open your app &rarr;{" "}
                <strong className="text-[#1f2328]">Incoming Webhooks</strong> and
                activate it.
              </li>
              <li>
                Click{" "}
                <strong className="text-[#1f2328]">
                  Add New Webhook to Workspace
                </strong>
                , pick your channel, and copy the URL.
              </li>
            </ol>
            <p className="text-[11px] text-[#656d76] pt-1 border-t border-[#d0d7de]">
              Note: Webhook URLs are encrypted at rest with AES-256-GCM.
            </p>
          </div>
        </div>

        {/* Right Column: Active Integrations */}
        <div className="lg:col-span-6 space-y-4">
          <span className="text-xs font-bold text-[#1f2328] font-mono uppercase tracking-wider block">
            Active Webhook Integrations ({integrations.length})
          </span>

          {integrations.length === 0 ? (
            <div className="panel rounded-md p-8 text-center space-y-2 bg-white border border-[#d0d7de]">
              <Bell className="h-6 w-6 text-[#656d76] mx-auto" />
              <h4 className="text-xs font-bold text-[#1f2328] font-mono uppercase">
                No Slack Integrations Configured
              </h4>
              <p className="text-xs text-[#656d76] max-w-sm mx-auto">
                Connect your Slack incoming webhook on the left to receive
                instant alerts when repository rules fire.
              </p>
            </div>
          ) : (
            <div className="panel rounded-md divide-y divide-[#d0d7de] overflow-hidden bg-white border border-[#d0d7de]">
              {integrations.map((item) => {
                const isLoadingAction = actionLoadingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#f6f8fa]/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1f2328] font-mono">
                          {item.repositoryName
                            ? item.repositoryName
                            : "Workspace Default"}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                          Active
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#656d76] font-mono">
                          <Lock className="h-2.5 w-2.5" /> AES-256
                        </span>
                      </div>
                      <p className="text-xs text-[#656d76] font-mono">
                        {item.channelName || "(No channel tag specified)"}
                      </p>
                      <p className="text-[11px] text-[#656d76] font-mono">
                        Target: {item.webhookUrlMask}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleTestSlack(item.id)}
                        disabled={isTestingSlack}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#d0d7de] hover:bg-[#f6f8fa] text-xs font-mono text-[#1f2328] transition-colors"
                      >
                        <Send className="h-3 w-3" />
                        <span>Test</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSlack(item.id)}
                        disabled={isLoadingAction}
                        className="p-1 rounded text-[#656d76] hover:text-[#cf222e] hover:bg-[#f6f8fa] transition-colors"
                        title="Delete webhook"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
