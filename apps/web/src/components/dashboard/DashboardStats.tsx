"use client";

import React from "react";

interface DashboardStatsProps {
  connectedCount: number;
  totalReposCount: number;
  rulesCount: number;
  hasSlackConfigured: boolean;
  slackIntegrationsCount: number;
  totalActionsCount: number;
}

export function DashboardStats({
  connectedCount,
  totalReposCount,
  rulesCount,
  hasSlackConfigured,
  slackIntegrationsCount,
  totalActionsCount,
}: DashboardStatsProps) {
  const stats = [
    {
      label: "Connected Repos",
      value: connectedCount,
      subtext: `${totalReposCount} Synced`,
      valueColor: "text-[#1f2328]",
      badge: null,
    },
    {
      label: "Active Rules",
      value: rulesCount,
      subtext: "Automated Triggers",
      valueColor: "text-[#1f2328]",
      badge: null,
    },
    {
      label: "Slack Webhook",
      value: null,
      subtext: `${slackIntegrationsCount} Active`,
      valueColor: null,
      badge: {
        text: hasSlackConfigured ? "Configured" : "Unset",
        className: hasSlackConfigured
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200",
      },
    },
    {
      label: "Dispatched Actions",
      value: totalActionsCount,
      subtext: "Labels & Slack",
      valueColor: "text-[#1f2328]",
      badge: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="panel rounded-md p-3.5 bg-white border border-[#d0d7de] shadow-xs"
        >
          <span className="text-[11px] font-mono text-[#656d76] uppercase block">
            {stat.label}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            {stat.value !== null ? (
              <span className={`text-xl font-bold font-mono ${stat.valueColor}`}>
                {stat.value}
              </span>
            ) : stat.badge ? (
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${stat.badge.className}`}
              >
                {stat.badge.text}
              </span>
            ) : null}
            <span className="text-[11px] text-[#656d76] font-mono">
              {stat.subtext}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
