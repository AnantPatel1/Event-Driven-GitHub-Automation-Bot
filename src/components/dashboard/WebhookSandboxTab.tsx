"use client";

import React, { useState } from "react";
import { Play } from "lucide-react";
import type { RepositoryItem } from "@github-bot/shared";
import { apiFetch } from "../../lib/api";

interface WebhookSandboxTabProps {
  connectedRepos: RepositoryItem[];
  username: string;
  onNavigateToRepos: () => void;
  onStatusMessage: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
}

export function WebhookSandboxTab({
  connectedRepos,
  username,
  onNavigateToRepos,
  onStatusMessage,
}: WebhookSandboxTabProps) {
  const [sandboxRepo, setSandboxRepo] = useState(
    connectedRepos[0]?.fullName || ""
  );
  const [sandboxEventType, setSandboxEventType] = useState<"issues" | "pull_request">("issues");
  const [sandboxTitle, setSandboxTitle] = useState("");
  const [sandboxIssueNumber, setSandboxIssueNumber] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  const handleDispatchSimulation = async () => {
    if (!sandboxRepo) {
      onStatusMessage({
        type: "error",
        text: "Select a connected repository to test webhooks.",
      });
      return;
    }

    setIsSimulating(true);
    onStatusMessage(null);
    setSandboxResult(null);

    const title = sandboxTitle.trim() || "Issue Title Test";

    try {
      const res = await apiFetch("/webhooks/simulate", {
        method: "POST",
        body: JSON.stringify({
          eventType: sandboxEventType,
          action: "opened",
          repositoryFullName: sandboxRepo,
          issueTitle: title,
          issueNumber: sandboxIssueNumber || 1,
        }),
      });

      if (res.ok && res.data) {
        setSandboxResult(res.data);
        onStatusMessage({
          type: "success",
          text: `Inbound delivery for "${title}" processed. Dispatched ${
            res.data.event?.actions?.length || 0
          } downstream action(s).`,
        });
      } else {
        onStatusMessage({
          type: "error",
          text: res.data?.error || "Webhook dispatch failed",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error communicating with webhook ingestion endpoint",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Form */}
      <div className="lg:col-span-6 space-y-4">
        <div className="panel rounded-md p-5 space-y-4 bg-white border border-[#d0d7de]">
          <div>
            <h3 className="text-sm font-bold text-[#1f2328] font-mono uppercase tracking-wider">
              Inbound Webhook Payload Sandbox
            </h3>
            <p className="text-xs text-[#656d76] mt-1">
              Simulate an authentic GitHub webhook delivery for your connected
              repositories to test rule matching and downstream dispatches.
            </p>
          </div>

          {connectedRepos.length === 0 ? (
            <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">
                No connected repositories available.
              </p>
              <p className="text-[11px] text-amber-800">
                Connect a repository in the Repositories tab first before running
                webhook simulations.
              </p>
              <button
                onClick={onNavigateToRepos}
                className="px-3 py-1.5 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-medium font-mono text-[11px]"
              >
                Go to Repositories
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#1f2328] font-medium">
                  Connected Repository
                </label>
                <select
                  value={sandboxRepo}
                  onChange={(e) => setSandboxRepo(e.target.value)}
                  className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                >
                  {connectedRepos.map((r) => (
                    <option key={r.id} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#1f2328] font-medium">Event Type</label>
                  <select
                    value={sandboxEventType}
                    onChange={(e) =>
                      setSandboxEventType(e.target.value as any)
                    }
                    className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                  >
                    <option value="issues">issues (opened)</option>
                    <option value="pull_request">pull_request (opened)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#1f2328] font-medium">
                    Issue / PR Number
                  </label>
                  <input
                    type="number"
                    value={sandboxIssueNumber}
                    onChange={(e) =>
                      setSandboxIssueNumber(parseInt(e.target.value, 10) || 1)
                    }
                    min={1}
                    className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#1f2328] font-medium">
                  {sandboxEventType === "issues" ? "Issue" : "PR"} Title (Test
                  Payload)
                </label>
                <input
                  type="text"
                  value={sandboxTitle}
                  onChange={(e) => setSandboxTitle(e.target.value)}
                  placeholder='e.g. Critical Bug: Crash on login or "Security fix"'
                  className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                />
                <p className="text-[11px] text-[#656d76]">
                  Tip: Include keywords configured in your rules (like &ldquo;bug&rdquo;)
                  to observe trigger matching.
                </p>
              </div>

              <button
                onClick={handleDispatchSimulation}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <Play
                  className={`h-3.5 w-3.5 ${isSimulating ? "animate-spin" : ""}`}
                />
                <span>
                  {isSimulating ? "Ingesting Payload..." : "Dispatch Synthetic Webhook"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Wire Payload Preview & Outcome */}
      <div className="lg:col-span-6 space-y-4">
        <div className="panel rounded-md overflow-hidden bg-white border border-[#d0d7de]">
          <div className="px-4 py-2 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between text-xs font-mono text-[#656d76]">
            <span>POST /webhooks/github</span>
            <span className="text-[10px] text-[#1a7f37] font-semibold">
              HMAC-SHA256 SIGNED
            </span>
          </div>

          <div className="p-4 text-xs font-mono space-y-3 text-[#1f2328] bg-white">
            <div>
              <span className="text-[#656d76] block text-[11px]"># Headers:</span>
              <p className="text-[11px] text-[#656d76]">
                X-GitHub-Event: {sandboxEventType}
                <br />
                X-GitHub-Delivery: sim_{Math.floor(Date.now() / 1000)}
                <br />
                X-Hub-Signature-256: sha256=verified_hmac_digest
              </p>
            </div>

            {sandboxRepo && (
              <div>
                <span className="text-[#656d76] block text-[11px]">
                  # Wire Payload:
                </span>
                <pre className="p-3 rounded-md bg-[#f6f8fa] border border-[#d0d7de] text-[11px] text-[#1f2328] overflow-x-auto">
                  {JSON.stringify(
                    {
                      action: "opened",
                      [sandboxEventType === "issues" ? "issue" : "pull_request"]: {
                        number: sandboxIssueNumber || 1,
                        title: sandboxTitle || "(untitled)",
                        user: { login: username },
                      },
                      repository: {
                        full_name: sandboxRepo,
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {sandboxResult && (
              <div className="pt-2 border-t border-[#d0d7de] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1f2328] text-xs">
                    Ingestion Outcome:
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {sandboxResult.event?.status || "PROCESSED"}
                  </span>
                </div>
                <p className="text-[11px] text-[#656d76]">
                  Dispatched {sandboxResult.event?.actions?.length || 0} downstream
                  action(s). Switch to Deliveries & Audit tab for complete
                  execution trace.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
