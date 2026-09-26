"use client";

import React from "react";
import {
  FolderGit2,
  Sliders,
  History,
  Bell,
  Terminal,
  Plus,
} from "lucide-react";

export type TabType = "repos" | "rules" | "events" | "integrations" | "sandbox";

interface DashboardNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  reposCount?: number;
  rulesCount?: number;
  slackIntegrationsCount?: number;
  hasSlackConfigured?: boolean;
  canCreateRule?: boolean;
  onOpenCreateRuleModal?: () => void;
}

export function DashboardNav({
  activeTab,
  onTabChange,
  reposCount,
  rulesCount,
  slackIntegrationsCount,
  hasSlackConfigured,
  canCreateRule = false,
  onOpenCreateRuleModal,
}: DashboardNavProps) {
  const tabs = [
    {
      id: "repos" as TabType,
      label: "Repositories",
      icon: FolderGit2,
      badge:
        reposCount !== undefined ? (
          <span className="px-1.5 py-0.2 rounded bg-[#f6f8fa] text-[#656d76] border border-[#d0d7de] text-[10px] font-mono">
            {reposCount}
          </span>
        ) : null,
    },
    {
      id: "rules" as TabType,
      label: "Automation Rules",
      icon: Sliders,
      badge:
        rulesCount !== undefined ? (
          <span className="px-1.5 py-0.2 rounded bg-[#f6f8fa] text-[#656d76] border border-[#d0d7de] text-[10px] font-mono">
            {rulesCount}
          </span>
        ) : null,
    },
    {
      id: "events" as TabType,
      label: "Deliveries & Audit",
      icon: History,
      badge: (
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      ),
    },
    {
      id: "integrations" as TabType,
      label: "Slack Integrations",
      icon: Bell,
      badge:
        slackIntegrationsCount !== undefined ? (
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
              hasSlackConfigured
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-[#f6f8fa] text-[#656d76] border-[#d0d7de]"
            }`}
          >
            {slackIntegrationsCount}
          </span>
        ) : null,
    },
    {
      id: "sandbox" as TabType,
      label: "Webhook Sandbox",
      icon: Terminal,
      badge: null,
    },
  ];

  return (
    <div className="flex items-center justify-between border-b border-[#d0d7de] pb-px">
      <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto scrollbar-none py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-[#0969da] text-[#1f2328]"
                  : "border-transparent text-[#656d76] hover:text-[#1f2328]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        {activeTab === "rules" && onOpenCreateRuleModal && (
          <button
            onClick={onOpenCreateRuleModal}
            disabled={!canCreateRule}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white transition-colors shadow-xs disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Rule</span>
          </button>
        )}
      </div>
    </div>
  );
}
