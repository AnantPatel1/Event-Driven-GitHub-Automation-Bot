"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Filter,
  RefreshCw,
  History,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Sparkles,
  Tag,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type { GitHubEventItem, PaginatedEventsResponse } from "@github-bot/shared";
import { apiFetch } from "../../lib/api";
import { Pagination } from "../Pagination";

interface EventsAuditTabProps {
  onTotalActionsUpdate?: (total: number) => void;
  onStatusMessage?: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
}

export function EventsAuditTab({
  onTotalActionsUpdate,
  onStatusMessage,
}: EventsAuditTabProps) {
  const [events, setEvents] = useState<GitHubEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState<"all" | "PROCESSED" | "IGNORED" | "FAILED">("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Server-side pagination states
  const [eventPage, setEventPage] = useState(1);
  const [eventLimit, setEventLimit] = useState(10);
  const [eventPagination, setEventPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalActions?: number;
  }>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    totalActions: 0,
  });

  const fetchEvents = useCallback(
    async (page = eventPage, limit = eventLimit, filter = eventFilter) => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (filter !== "all") {
          queryParams.append("status", filter);
        }

        const res = await apiFetch<PaginatedEventsResponse>(
          `/events?${queryParams.toString()}`
        );
        if (res.ok && res.data) {
          const items = res.data.events || [];
          setEvents(items);
          if (res.data.pagination) {
            setEventPagination(res.data.pagination);
            if (res.data.pagination.totalActions !== undefined) {
              onTotalActionsUpdate?.(res.data.pagination.totalActions);
            }
          }
        }
      } catch {
        onStatusMessage?.({
          type: "error",
          text: "Network error loading event audit logs.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [eventPage, eventLimit, eventFilter, onTotalActionsUpdate, onStatusMessage]
  );

  // Fetch ONLY when mounted/active, and poll every 6s while active
  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => {
      fetchEvents();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleFilterChange = (filter: "all" | "PROCESSED" | "IGNORED" | "FAILED") => {
    setEventFilter(filter);
    setEventPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filter & Refresh Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#656d76]" />
          <span className="text-xs text-[#656d76] font-medium">Status Filter:</span>
          {(["all", "PROCESSED", "IGNORED", "FAILED"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors font-mono ${
                eventFilter === filter
                  ? "bg-[#1f2328] text-white"
                  : "bg-white text-[#656d76] border border-[#d0d7de] hover:bg-[#f3f4f6]"
              }`}
            >
              {filter === "all" ? "ALL" : filter}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchEvents()}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white border border-[#d0d7de] text-[#1f2328] hover:bg-[#f3f4f6] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Main Delivery Records Panel */}
      {events.length === 0 && !isLoading ? (
        <div className="panel rounded-md p-10 text-center space-y-2 bg-white border border-[#d0d7de]">
          <History className="h-7 w-7 text-[#656d76] mx-auto" />
          <h4 className="text-xs font-bold text-[#1f2328] uppercase tracking-wider font-mono">
            No Webhook Deliveries Recorded
          </h4>
          <p className="text-xs text-[#656d76] max-w-sm mx-auto">
            Deliveries will appear here in real time as GitHub webhooks fire for
            your connected repositories.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="panel rounded-md divide-y divide-[#d0d7de] overflow-hidden bg-white border border-[#d0d7de]">
            <div className="px-4 py-2 bg-[#f6f8fa] flex items-center justify-between text-[11px] font-mono uppercase text-[#656d76] tracking-wider border-b border-[#d0d7de]">
              <span>Delivery Record</span>
              <span>Dispatches & Timestamp</span>
            </div>

            {events.map((ev) => {
              const isExpanded = expandedEventId === ev.id;
              return (
                <div key={ev.id} className="transition-colors">
                  <div
                    onClick={() =>
                      setExpandedEventId(isExpanded ? null : ev.id)
                    }
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#f6f8fa]/60"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-[#656d76]">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#1f2328] font-mono">
                            {ev.repositoryName || "Unknown"}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#f6f8fa] text-[#0969da] border border-[#d0d7de] font-mono font-medium">
                            {ev.eventType}
                            {ev.action ? `.${ev.action}` : ""}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                              ev.status === "PROCESSED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : ev.status === "IGNORED"
                                  ? "bg-slate-100 text-[#656d76] border border-[#d0d7de]"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-[#656d76]">
                          delivery: {ev.deliveryId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-[#656d76]">
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-[#0969da]" />
                        {ev.actions?.length || 0} action(s)
                      </span>
                      <span>
                        {new Date(ev.receivedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Audit Log Details */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-[#f6f8fa] border-t border-[#d0d7de] space-y-4">
                      {/* AI Triage Card if ai.triage action exists */}
                      {ev.actions?.some((a) => a.type === "ai.triage") && (
                        <div className="p-3.5 rounded-md bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-900 flex items-center gap-1.5 font-mono text-[11px]">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              Google Gemini 1.5 Flash AI Triage
                            </span>
                            {(() => {
                              const triage = ev.actions.find(
                                (a) => a.type === "ai.triage"
                              )?.details as any;
                              if (!triage?.priority) return null;
                              return (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    triage.priority === "P0"
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : triage.priority === "P1"
                                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                                        : triage.priority === "P2"
                                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                                          : "bg-slate-100 text-slate-700 border border-slate-300"
                                  }`}
                                >
                                  PRIORITY: {triage.priority}
                                </span>
                              );
                            })()}
                          </div>

                          {(() => {
                            const triage = ev.actions.find(
                              (a) => a.type === "ai.triage"
                            )?.details as any;
                            if (!triage) return null;
                            return (
                              <div className="space-y-2 text-[#1f2328]">
                                <p className="text-xs text-slate-700 italic">
                                  &ldquo;{triage.summary}&rdquo;
                                </p>
                                <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-slate-600 flex-wrap">
                                  {triage.suggestedLabel && (
                                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                                      <Tag className="h-3 w-3" />
                                      Suggested Label:{" "}
                                      <strong>{triage.suggestedLabel}</strong>
                                    </span>
                                  )}
                                  {triage.priorityReason && (
                                    <span>Reason: {triage.priorityReason}</span>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    Provider: {triage.provider || "Gemini Flash"}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Action Execution Logs */}
                      {ev.actions?.length === 0 ? (
                        <p className="text-xs text-[#656d76] italic">
                          No downstream bot actions were triggered for this
                          delivery.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono text-[#656d76] uppercase tracking-wider block">
                            Executed Dispatches ({ev.actions.length})
                          </span>
                          {ev.actions.map((act) => {
                            const isAi = act.type === "ai.triage";
                            return (
                              <div
                                key={act.id}
                                className="p-3 rounded-md bg-white border border-[#d0d7de] space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="font-mono text-xs font-semibold text-[#1f2328]">
                                      {act.type}
                                    </span>

                                    {/* Clean concise summary based on action type */}
                                    {act.type === "github.add_label" ? (
                                      <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-[#656d76]">repo:</span>
                                        <span className="font-semibold text-[#1f2328]">
                                          {ev.repositoryName || "Repository"}
                                        </span>
                                        <span className="text-[#d0d7de]">•</span>
                                        <span className="text-[#656d76]">label:</span>
                                        <span className="px-1.5 py-0.2 rounded bg-[#f6f8fa] border border-[#d0d7de] text-[#0969da] font-semibold">
                                          {(act.details as any)?.label ||
                                            (Array.isArray((act.details as any)?.result)
                                              ? (act.details as any).result[0]?.name
                                              : null) ||
                                            "bug"}
                                        </span>
                                      </div>
                                    ) : act.type === "slack.notify" ? (
                                      <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-[#656d76]">time:</span>
                                        <span className="font-semibold text-[#1f2328] bg-[#f6f8fa] px-1.5 py-0.2 rounded border border-[#d0d7de]">
                                          {(() => {
                                            const raw =
                                              (act.details as any)?.details?.timestamp ||
                                              (act.details as any)?.timestamp ||
                                              act.createdAt;
                                            if (!raw) return "Delivered (IST)";
                                            const d = new Date(raw);
                                            return isNaN(d.getTime())
                                              ? "Delivered (IST)"
                                              : d.toLocaleTimeString("en-US", {
                                                  timeZone: "Asia/Kolkata",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  second: "2-digit",
                                                  hour12: true,
                                                }) + " IST";
                                          })()}
                                        </span>
                                      </div>
                                    ) : isAi ? (
                                      <span className="text-[11px] text-[#656d76] font-mono">
                                        (Confidence:{" "}
                                        {(act.details as any)?.confidence
                                          ? Math.round((act.details as any).confidence * 100)
                                          : 95}
                                        %)
                                      </span>
                                    ) : act.details ? (
                                      <span className="text-[11px] text-[#656d76] font-mono">
                                        {JSON.stringify(act.details)}
                                      </span>
                                    ) : null}
                                  </div>

                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                                      act.status === "SUCCESS"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : act.status === "SKIPPED"
                                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {act.status}
                                  </span>
                                </div>

                                {act.error && (
                                  <div className="flex items-center gap-1.5 text-xs text-[#cf222e] font-mono">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>{act.error}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={eventPage}
            totalPages={eventPagination.totalPages}
            totalItems={eventPagination.total}
            pageSize={eventLimit}
            onPageChange={(page) => setEventPage(page)}
            onPageSizeChange={(limit) => {
              setEventLimit(limit);
              setEventPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            itemName="deliveries"
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
