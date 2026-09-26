"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sliders,
  AlertCircle,
  Plus,
  Play,
  Trash2,
  Tag,
  MessageSquare,
  Bell,
  AlertTriangle,
} from "lucide-react";
import type { RuleItem, RepositoryItem } from "@github-bot/shared";
import { apiFetch } from "../../lib/api";
import { Pagination } from "../Pagination";
import { CreateRuleModal } from "./CreateRuleModal";

interface RulesTabProps {
  connectedRepos: RepositoryItem[];
  hasSlackConfigured: boolean;
  onStatusMessage: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
  onRulesLoaded?: (rules: RuleItem[]) => void;
  onNavigateToRepos: () => void;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
}

export function RulesTab({
  connectedRepos,
  hasSlackConfigured,
  onStatusMessage,
  onRulesLoaded,
  onNavigateToRepos,
  showCreateModal,
  setShowCreateModal,
}: RulesTabProps) {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rulePage, setRulePage] = useState(1);
  const [rulePageSize, setRulePageSize] = useState(6);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ rules: RuleItem[] }>("/rules");
      if (res.ok && res.data) {
        const fetchedRules = res.data.rules || [];
        setRules(fetchedRules);
        onRulesLoaded?.(fetchedRules);
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to load automation rules.",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error loading rules.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onRulesLoaded, onStatusMessage]);

  // Fetch rules ONLY when mounted/active!
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Toggle rule enabled/paused
  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    setActionLoadingId(ruleId);
    onStatusMessage(null);
    try {
      const res = await apiFetch(`/rules/${ruleId}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        onStatusMessage({
          type: "success",
          text: `Rule ${!currentEnabled ? "activated" : "paused"}.`,
        });
        await fetchRules();
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to toggle rule state",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm("Are you sure you want to delete this automation rule?")) {
      return;
    }
    setActionLoadingId(ruleId);
    onStatusMessage(null);
    try {
      const res = await apiFetch(`/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onStatusMessage({
          type: "warning",
          text: "Rule permanently deleted.",
        });
        await fetchRules();
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to delete rule",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Paginated rules
  const totalRulePages = Math.ceil(rules.length / rulePageSize) || 1;
  const paginatedRules = useMemo(() => {
    const start = (rulePage - 1) * rulePageSize;
    return rules.slice(start, start + rulePageSize);
  }, [rules, rulePage, rulePageSize]);

  return (
    <div className="space-y-4">
      {connectedRepos.length === 0 ? (
        <div className="panel rounded-md p-8 text-center space-y-3 bg-white border border-[#d0d7de]">
          <AlertCircle className="h-6 w-6 text-amber-600 mx-auto" />
          <h4 className="text-xs font-bold text-[#1f2328] uppercase tracking-wider font-mono">
            No Connected Repositories
          </h4>
          <p className="text-xs text-[#656d76] max-w-sm mx-auto">
            Connect a repository in the Repositories tab first to configure
            automated triage rules.
          </p>
          <button
            onClick={onNavigateToRepos}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-[#d0d7de] text-[#1f2328] hover:bg-[#f3f4f6]"
          >
            View Repositories
          </button>
        </div>
      ) : rules.length === 0 && !isLoading ? (
        <div className="panel rounded-md p-10 text-center space-y-3 bg-white border border-[#d0d7de]">
          <Sliders className="h-7 w-7 text-[#656d76] mx-auto" />
          <h4 className="text-xs font-bold text-[#1f2328] uppercase tracking-wider font-mono">
            No Triage Rules Configured
          </h4>
          <p className="text-xs text-[#656d76] max-w-sm mx-auto">
            Create an automated triage rule: When an issue or PR condition
            matches, automatically apply labels and post alerts.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white shadow-xs"
          >
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {paginatedRules.map((rule) => {
              const hasSlackAction = rule.actions.some(
                (a) => a.type === "slack.notify"
              );
              const isSlackUnset = hasSlackAction && !hasSlackConfigured;

              return (
                <div
                  key={rule.id}
                  className="panel rounded-md p-4 space-y-3 bg-white border border-[#d0d7de]"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#d0d7de]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#1f2328] font-mono">
                        {rule.repositoryName}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#f6f8fa] text-[#0969da] border border-[#d0d7de]">
                        EVENT: {rule.eventType}
                      </span>
                      {rule.enabled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-[#656d76] border border-[#d0d7de]">
                          PAUSED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.enabled)}
                        disabled={actionLoadingId === rule.id}
                        className="px-2.5 py-1 rounded border border-[#d0d7de] bg-white hover:bg-[#f6f8fa] text-[#1f2328] text-xs font-mono transition-colors"
                      >
                        {rule.enabled ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={actionLoadingId === rule.id}
                        className="p-1 rounded text-[#656d76] hover:text-[#cf222e] hover:bg-[#f6f8fa] transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isSlackUnset && (
                    <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>
                        Rule dispatches Slack alert, but no Slack webhook is
                        configured yet.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="space-y-1">
                      <span className="text-[#656d76] text-[11px] uppercase block font-sans">
                        Trigger Condition (IF)
                      </span>
                      <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#d0d7de] space-y-1">
                        {rule.conditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#1f2328]">
                              {cond.field}
                            </span>
                            <span className="text-[#656d76]">{cond.operator}</span>
                            <span className="px-1.5 py-0.2 rounded bg-white border border-[#d0d7de] text-[#0969da]">
                              &ldquo;{cond.value}&rdquo;
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#656d76] text-[11px] uppercase block font-sans">
                        Automated Dispatches (THEN)
                      </span>
                      <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#d0d7de] flex items-center gap-2 flex-wrap">
                        {rule.actions.map((act, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#d0d7de] text-[#1f2328] font-mono text-[11px]"
                          >
                            {act.type === "github.add_label" && (
                              <Tag className="h-3 w-3 text-[#0969da]" />
                            )}
                            {act.type === "github.comment" && (
                              <MessageSquare className="h-3 w-3 text-[#0550ae]" />
                            )}
                            {act.type === "slack.notify" && (
                              <Bell className="h-3 w-3 text-[#9a6700]" />
                            )}
                            <span>{act.type}</span>
                            {act.label && (
                              <span className="text-[#0969da] font-semibold">
                                ({act.label})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={rulePage}
            totalPages={totalRulePages}
            totalItems={rules.length}
            pageSize={rulePageSize}
            onPageChange={(page) => setRulePage(page)}
            onPageSizeChange={(size) => {
              setRulePageSize(size);
              setRulePage(1);
            }}
            pageSizeOptions={[6, 12, 24]}
            itemName="rules"
          />
        </div>
      )}

      {/* Modal */}
      <CreateRuleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        connectedRepos={connectedRepos}
        onRuleCreated={fetchRules}
        onStatusMessage={onStatusMessage}
      />
    </div>
  );
}
