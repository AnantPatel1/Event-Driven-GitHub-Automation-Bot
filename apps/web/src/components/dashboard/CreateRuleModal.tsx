"use client";

import React, { useState } from "react";
import type { RepositoryItem, ActionDefinition } from "@github-bot/shared";
import { apiFetch } from "../../lib/api";

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedRepos: RepositoryItem[];
  onRuleCreated: () => void;
  onStatusMessage: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
}

export function CreateRuleModal({
  isOpen,
  onClose,
  connectedRepos,
  onRuleCreated,
  onStatusMessage,
}: CreateRuleModalProps) {
  const [targetRepoId, setTargetRepoId] = useState(
    connectedRepos[0]?.id || ""
  );
  const [eventType, setEventType] = useState<"issues" | "pull_request">("issues");
  const [field, setField] = useState("issue.title");
  const [operator, setOperator] = useState<"contains" | "equals" | "starts_with">("contains");
  const [value, setValue] = useState("bug");
  const [label, setLabel] = useState("bug");
  const [slack, setSlack] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRepoId) {
      onStatusMessage({
        type: "error",
        text: "Please select a target repository for the rule.",
      });
      return;
    }

    setIsSubmitting(true);
    onStatusMessage(null);

    const actions: ActionDefinition[] = [];
    if (label.trim()) {
      actions.push({ type: "github.add_label", label: label.trim() });
    }
    if (slack) {
      actions.push({ type: "slack.notify" });
    }

    try {
      const res = await apiFetch("/rules", {
        method: "POST",
        body: JSON.stringify({
          repositoryId: targetRepoId,
          eventType,
          conditions: [
            {
              field,
              operator,
              value,
            },
          ],
          actions,
          enabled: true,
        }),
      });

      if (res.ok) {
        onStatusMessage({
          type: "success",
          text: `Automation rule created successfully.`,
        });
        onRuleCreated();
        onClose();
      } else {
        onStatusMessage({
          type: "error",
          text: res.data?.error || "Failed to create rule",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error creating rule",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="panel w-full max-w-lg rounded-md p-6 space-y-5 border border-[#d0d7de] shadow-xl bg-white">
        <div className="pb-3 border-b border-[#d0d7de]">
          <h3 className="text-sm font-bold text-[#1f2328] font-mono uppercase tracking-wider">
            Create Triage Rule
          </h3>
          <p className="text-xs text-[#656d76] mt-1">
            Define trigger matching conditions and automated actions for
            incoming repository events.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-[#1f2328] font-medium">Target Repository</label>
            <select
              value={targetRepoId}
              onChange={(e) => setTargetRepoId(e.target.value)}
              className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
              required
            >
              {connectedRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[#1f2328] font-medium">Trigger Event</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
            >
              <option value="issues">issues (opened, labeled, edited)</option>
              <option value="pull_request">pull_request (opened, synchronized)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-md bg-[#f6f8fa] border border-[#d0d7de] space-y-2">
            <span className="font-semibold text-[#1f2328] text-[11px] uppercase tracking-wider font-mono">
              Matching Condition (IF)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="Field (e.g. issue.title)"
                className="p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                required
              />
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as any)}
                className="p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
              >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
                <option value="starts_with">starts_with</option>
              </select>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value (e.g. bug)"
                className="p-2 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none focus:border-[#0969da] font-mono"
                required
              />
            </div>
          </div>

          <div className="p-3.5 rounded-md bg-[#f6f8fa] border border-[#d0d7de] space-y-3">
            <span className="font-semibold text-[#1f2328] text-[11px] uppercase tracking-wider font-mono">
              Automated Actions (THEN)
            </span>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="labelCheckbox"
                  checked={!!label}
                  onChange={(e) => setLabel(e.target.checked ? "bug" : "")}
                  className="rounded"
                />
                <label htmlFor="labelCheckbox" className="text-[#1f2328]">
                  Add GitHub Label:
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label name (e.g. bug)"
                  className="p-1.5 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] text-xs outline-none flex-1 focus:border-[#0969da] font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="slackCheckbox"
                  checked={slack}
                  onChange={(e) => setSlack(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="slackCheckbox" className="text-[#1f2328]">
                  Dispatch formatted operational alert to Slack channel
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d7de]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] hover:bg-[#f6f8fa] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
