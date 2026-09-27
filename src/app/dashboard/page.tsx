"use client";

import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";
import {
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type { RepositoryItem, RuleItem, SlackIntegrationItem } from "@github-bot/shared";

// Modular Dashboard Components
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { DashboardStats } from "../../components/dashboard/DashboardStats";
import { DashboardNav, TabType } from "../../components/dashboard/DashboardNav";
import { RepositoriesTab } from "../../components/dashboard/RepositoriesTab";
import { RulesTab } from "../../components/dashboard/RulesTab";
import { EventsAuditTab } from "../../components/dashboard/EventsAuditTab";
import { SlackIntegrationsTab } from "../../components/dashboard/SlackIntegrationsTab";
import { WebhookSandboxTab } from "../../components/dashboard/WebhookSandboxTab";

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading, loginWithGitHub, logout } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<TabType>("repos");

  // Status message banner
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Modal toggle state (for New Rule button in nav or rules tab)
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);

  // Shared lightweight cache for stats & cross-tab references
  const [cachedRepos, setCachedRepos] = useState<RepositoryItem[]>([]);
  const [rulesCount, setRulesCount] = useState(0);
  const [slackIntegrationsCount, setSlackIntegrationsCount] = useState(0);
  const [hasSlackConfigured, setHasSlackConfigured] = useState(false);
  const [totalActionsCount, setTotalActionsCount] = useState(0);
  const [hasRulesRequiringSlack, setHasRulesRequiringSlack] = useState(false);

  // Sync repos loaded from RepositoriesTab
  const handleReposLoaded = useCallback((repos: RepositoryItem[]) => {
    setCachedRepos(repos);
  }, []);

  // Sync rules loaded from RulesTab
  const handleRulesLoaded = useCallback((rules: RuleItem[]) => {
    setRulesCount(rules.length);
    const requiresSlack = rules.some(
      (r) => r.enabled && r.actions.some((a) => a.type === "slack.notify")
    );
    setHasRulesRequiringSlack(requiresSlack);
  }, []);

  // Sync integrations loaded from SlackIntegrationsTab
  const handleSlackIntegrationsLoaded = useCallback((items: SlackIntegrationItem[]) => {
    setSlackIntegrationsCount(items.length);
    setHasSlackConfigured(items.length > 0);
  }, []);

  // Sync total actions count from EventsAuditTab
  const handleTotalActionsUpdate = useCallback((count: number) => {
    setTotalActionsCount(count);
  }, []);

  // Compute connected repositories
  const connectedRepos = cachedRepos.filter((r) => r.isConnected);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 min-h-screen bg-[#f6f8fa] text-[#1f2328]">
        <div className="h-6 w-6 border-2 border-[#0969da] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#656d76] font-mono">
          Authenticating session...
        </p>
      </div>
    );
  }

  // Unauthenticated screen
  if (!isAuthenticated || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 min-h-screen bg-[#f6f8fa] text-[#1f2328]">
        <div className="panel max-w-sm w-full p-8 text-center space-y-4 bg-white border border-[#d0d7de] rounded-md shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center mx-auto text-[#0969da]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-[#1f2328]">
              Authentication Required
            </h2>
            <p className="text-xs text-[#656d76] mt-1">
              Please sign in with your GitHub account to access connected
              repositories and triage rules.
            </p>
          </div>
          <button
            onClick={loginWithGitHub}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-[#24292f] hover:bg-[#1f2328] text-white transition-colors shadow-xs"
          >
            <span>Sign in with GitHub (OAuth)</span>
          </button>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#656d76] hover:text-[#1f2328] transition-colors pt-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      {/* 1. Header Bar */}
      <DashboardHeader
        user={user}
        onOpenSandbox={() => setActiveTab("sandbox")}
        onLogout={logout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Status Notification Toast */}
        {statusMessage && (
          <div
            className={`flex items-center justify-between p-3 rounded-md text-xs font-medium border shadow-xs ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : statusMessage.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              {statusMessage.type === "warning" && (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              {statusMessage.type === "error" && (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-[#656d76] hover:text-[#1f2328] font-mono text-sm leading-none ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* 2. Top Stats Section */}
        <DashboardStats
          connectedCount={connectedRepos.length}
          totalReposCount={cachedRepos.length}
          rulesCount={rulesCount}
          hasSlackConfigured={hasSlackConfigured}
          slackIntegrationsCount={slackIntegrationsCount}
          totalActionsCount={totalActionsCount}
        />

        {/* 3. Navigation Bar */}
        <DashboardNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          reposCount={cachedRepos.length > 0 ? cachedRepos.length : undefined}
          rulesCount={rulesCount > 0 ? rulesCount : undefined}
          slackIntegrationsCount={slackIntegrationsCount}
          hasSlackConfigured={hasSlackConfigured}
          canCreateRule={connectedRepos.length > 0}
          onOpenCreateRuleModal={() => setShowCreateRuleModal(true)}
        />

        {/* 4. Tab Content (Loaded only when needed) */}
        {activeTab === "repos" && (
          <RepositoriesTab
            onStatusMessage={setStatusMessage}
            onReposLoaded={handleReposLoaded}
          />
        )}

        {activeTab === "rules" && (
          <RulesTab
            connectedRepos={connectedRepos}
            hasSlackConfigured={hasSlackConfigured}
            onStatusMessage={setStatusMessage}
            onRulesLoaded={handleRulesLoaded}
            onNavigateToRepos={() => setActiveTab("repos")}
            showCreateModal={showCreateRuleModal}
            setShowCreateModal={setShowCreateRuleModal}
          />
        )}

        {activeTab === "events" && (
          <EventsAuditTab
            onTotalActionsUpdate={handleTotalActionsUpdate}
            onStatusMessage={setStatusMessage}
          />
        )}

        {activeTab === "integrations" && (
          <SlackIntegrationsTab
            connectedRepos={connectedRepos}
            showSlackWarning={hasRulesRequiringSlack && !hasSlackConfigured}
            onStatusMessage={setStatusMessage}
            onIntegrationsLoaded={handleSlackIntegrationsLoaded}
          />
        )}

        {activeTab === "sandbox" && (
          <WebhookSandboxTab
            connectedRepos={connectedRepos}
            username={user.githubUsername}
            onNavigateToRepos={() => setActiveTab("repos")}
            onStatusMessage={setStatusMessage}
          />
        )}
      </main>
    </div>
  );
}
