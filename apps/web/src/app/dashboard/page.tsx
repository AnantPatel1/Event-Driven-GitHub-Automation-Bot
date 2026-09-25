'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import type { RepositoryItem, RuleItem, GitHubEventItem } from '@github-bot/shared';
import {
  ShieldAlert,
  Github,
  LogOut,
  Radio,
  ArrowLeft,
  CheckCircle2,
  FolderGit2,
  Sliders,
  History,
  User,
  Sparkles,
  RefreshCw,
  Lock,
  Globe,
  Trash2,
  Plug,
  AlertCircle,
  Plus,
  Play,
  Tag,
  MessageSquare,
  Bell,
  Power,
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading, loginWithGitHub, loginDev, logout } = useAuth();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'repos' | 'rules' | 'events'>('repos');

  // Data states
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [events, setEvents] = useState<GitHubEventItem[]>([]);
  
  // Loading states
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Expanded event rows
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Status notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Rule Form Modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRuleRepoId, setNewRuleRepoId] = useState('');
  const [newRuleEventType, setNewRuleEventType] = useState<'issues' | 'pull_request'>('issues');
  const [newRuleField, setNewRuleField] = useState('issue.title');
  const [newRuleOperator, setNewRuleOperator] = useState<'contains' | 'equals' | 'starts_with'>('contains');
  const [newRuleValue, setNewRuleValue] = useState('bug');
  const [newRuleLabel, setNewRuleLabel] = useState('bug');
  const [newRuleSlack, setNewRuleSlack] = useState(true);

  // 1. Fetch Repositories
  const fetchRepositories = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingRepos(true);
    try {
      const res = await fetch(`${API_URL}/repositories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.repositories || []);
        if (data.repositories?.length > 0 && !newRuleRepoId) {
          const firstConnected = data.repositories.find((r: RepositoryItem) => r.isConnected);
          if (firstConnected?.id) setNewRuleRepoId(firstConnected.id);
        }
      }
    } catch {
      // silent catch
    } finally {
      setIsLoadingRepos(false);
    }
  }, [isAuthenticated, newRuleRepoId]);

  // 2. Fetch Rules
  const fetchRules = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingRules(true);
    try {
      const res = await fetch(`${API_URL}/rules`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // silent catch
    } finally {
      setIsLoadingRules(false);
    }
  }, [isAuthenticated]);

  // 3. Fetch Events & BotActions
  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingEvents(true);
    try {
      const res = await fetch(`${API_URL}/events`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // silent catch
    } finally {
      setIsLoadingEvents(false);
    }
  }, [isAuthenticated]);

  // Load all initial data on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchRepositories();
      fetchRules();
      fetchEvents();
    }
  }, [isAuthenticated, fetchRepositories, fetchRules, fetchEvents]);

  // Auto-refresh events every 6s when on events tab
  useEffect(() => {
    if (isAuthenticated && activeTab === 'events') {
      const interval = setInterval(fetchEvents, 6000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab, fetchEvents]);

  // Handle Connect
  const handleConnect = async (repoId: string, repoName: string) => {
    setActionLoadingId(repoId);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_URL}/repositories/${repoId}/connect`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: `Connected ${repoName} & registered webhook!` });
        await fetchRepositories();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to connect repository' });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async (repoIdOrDbId: string, repoName: string) => {
    setActionLoadingId(repoIdOrDbId);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_URL}/repositories/${repoIdOrDbId}/disconnect`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: `Disconnected ${repoName} and removed webhook.` });
        await fetchRepositories();
        await fetchRules();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to disconnect repository' });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Create Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleRepoId) {
      setStatusMessage({ type: 'error', text: 'Please select a connected repository.' });
      return;
    }

    const actions = [];
    if (newRuleLabel.trim()) {
      actions.push({ type: 'github.add_label', label: newRuleLabel.trim() });
    }
    if (newRuleSlack) {
      actions.push({ type: 'slack.notify', message: `Rule matched: ${newRuleField} ${newRuleOperator} "${newRuleValue}"` });
    }

    try {
      const res = await fetch(`${API_URL}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repositoryId: newRuleRepoId,
          eventType: newRuleEventType,
          conditions: [
            {
              field: newRuleField,
              operator: newRuleOperator,
              value: newRuleValue,
            },
          ],
          actions,
          enabled: true,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Automation rule created successfully!' });
        setShowRuleModal(false);
        await fetchRules();
        await fetchRepositories();
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Failed to create rule' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error creating rule' });
    }
  };

  // Handle Toggle Rule
  const handleToggleRule = async (ruleId: string) => {
    try {
      const res = await fetch(`${API_URL}/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch {
      // silent catch
    }
  };

  // Handle Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`${API_URL}/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Rule deleted.' });
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        await fetchRepositories();
      }
    } catch {
      // silent catch
    }
  };

  // Handle Simulate Webhook Event
  const handleSimulateWebhook = async (title = 'Bug: test GitHub automation') => {
    setIsSimulating(true);
    setStatusMessage(null);
    try {
      const connectedRepo = repositories.find((r) => r.isConnected);
      const repoFullName = connectedRepo?.fullName || `${user?.githubUsername}/project-a`;

      const res = await fetch(`${API_URL}/webhooks/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventType: 'issues',
          action: 'opened',
          repositoryFullName: repoFullName,
          issueTitle: title,
          issueNumber: Math.floor(Math.random() * 80) + 1,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Simulated webhook event "${title}" ingested & processed!`,
        });
        setActiveTab('events');
        await fetchEvents();
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Simulation failed' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error triggering webhook simulation' });
    } finally {
      setIsSimulating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Verifying authenticated session...</p>
      </div>
    );
  }

  // Enforce Protected Dashboard Access: Unauthenticated users are strictly blocked
  if (!isAuthenticated || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
          <p className="text-sm text-slate-400">
            You must be logged in with GitHub to access the automation dashboard, manage repository webhooks, and configure rules.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <button
            onClick={loginWithGitHub}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25"
          >
            <Github className="h-4 w-4" />
            Sign in with GitHub
          </button>
          <button
            onClick={() => loginDev('local-developer')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-card border border-surface-border hover:border-slate-600 text-slate-200 text-sm font-medium transition-all"
          >
            <Sparkles className="h-4 w-4 text-violet-400" />
            Quick Dev Login
          </button>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to System Overview
        </Link>
      </div>
    );
  }

  const connectedCount = repositories.filter((r) => r.isConnected).length;
  const connectedRepos = repositories.filter((r) => r.isConnected);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative">
      <div className="w-full max-w-6xl space-y-8">
        {/* Navigation & User Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-surface-card border border-surface-border text-slate-400 hover:text-white transition-colors"
              title="Return home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Automation Dashboard
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  All Engines Online
                </span>
              </h1>
              <p className="text-xs text-slate-400">Authenticated as @{user.githubUsername}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-end">
            <button
              onClick={() => handleSimulateWebhook('Bug: test GitHub automation')}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-violet-500/20 disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              Simulate &ldquo;Bug&rdquo; Webhook
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border">
              <div className="h-6 w-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                {user.githubUsername.slice(0, 2)}
              </div>
              <span className="font-semibold text-xs text-white">@{user.githubUsername}</span>
            </div>

            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* System Telemetry Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-slate-400">Authentication</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">GitHub OAuth</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-[10px] text-emerald-400 font-mono">httpOnly Signed Cookie</p>
          </div>

          <div
            onClick={() => setActiveTab('repos')}
            className="glass-panel glass-panel-hover rounded-xl p-4 space-y-1 cursor-pointer"
          >
            <span className="text-[11px] text-slate-400">Connected Repositories</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{connectedCount} Connected</p>
              <FolderGit2 className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-[10px] text-blue-400 font-mono">{repositories.length} Available on GitHub</p>
          </div>

          <div
            onClick={() => setActiveTab('rules')}
            className="glass-panel glass-panel-hover rounded-xl p-4 space-y-1 cursor-pointer"
          >
            <span className="text-[11px] text-slate-400">Automation Rules</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{rules.length} Active Rules</p>
              <Sliders className="h-4 w-4 text-violet-400" />
            </div>
            <p className="text-[10px] text-violet-400 font-mono">Dynamic conditions & actions</p>
          </div>

          <div
            onClick={() => setActiveTab('events')}
            className="glass-panel glass-panel-hover rounded-xl p-4 space-y-1 cursor-pointer"
          >
            <span className="text-[11px] text-slate-400">Events Ingested</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{events.length} Events</p>
              <History className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-[10px] text-cyan-400 font-mono">Strict deliveryId uniqueness</p>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-surface-border">
          <button
            onClick={() => setActiveTab('repos')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'repos'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="h-4 w-4" />
            Repositories ({repositories.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Automation Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'events'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-4 w-4" />
            Event & Action Audit Logs ({events.length})
          </button>
        </div>

        {/* TAB 1: REPOSITORIES */}
        {activeTab === 'repos' && (
          <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-surface-border pb-4 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FolderGit2 className="h-5 w-5 text-blue-400" />
                  GitHub Repositories
                </h3>
                <p className="text-xs text-slate-400">
                  Connect repositories to register webhooks for issues and pull requests
                </p>
              </div>
              <button
                onClick={fetchRepositories}
                disabled={isLoadingRepos}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-card border border-surface-border hover:border-blue-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {isLoadingRepos && repositories.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Fetching accessible repositories from GitHub API...</p>
              </div>
            ) : repositories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border p-8 text-center space-y-2">
                <FolderGit2 className="h-8 w-8 text-slate-500 mx-auto" />
                <p className="text-sm font-medium text-white">No repositories found</p>
                <p className="text-xs text-slate-400">No repositories available in your GitHub account scope.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {repositories.map((repo) => {
                  const isLoading = actionLoadingId === repo.githubRepositoryId || actionLoadingId === repo.id;
                  return (
                    <div
                      key={repo.githubRepositoryId}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all ${
                        repo.isConnected
                          ? 'bg-blue-500/5 border-blue-500/30'
                          : 'bg-surface/60 border-surface-border hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 mb-3 sm:mb-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{repo.fullName}</span>
                          {repo.isPrivate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Lock className="h-2.5 w-2.5" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              <Globe className="h-2.5 w-2.5" /> Public
                            </span>
                          )}
                          {repo.isConnected && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">
                          {repo.description || 'No description provided'}
                        </p>
                        {repo.isConnected && (
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 font-mono">
                            <span>Webhook ID: {repo.webhookId}</span>
                            <span>&bull;</span>
                            <span>Rules: {repo.ruleCount}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        {repo.isConnected ? (
                          <button
                            onClick={() => handleDisconnect(repo.id || repo.githubRepositoryId, repo.fullName)}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-all disabled:opacity-50"
                          >
                            {isLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(repo.githubRepositoryId, repo.fullName)}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                          >
                            {isLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: AUTOMATION RULES */}
        {activeTab === 'rules' && (
          <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-surface-border pb-4 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-violet-400" />
                  Configurable Rule Engine
                </h3>
                <p className="text-xs text-slate-400">
                  Trigger automated GitHub labels, comments, and Slack operational alerts when webhook conditions are met
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchRules}
                  disabled={isLoadingRules}
                  className="p-2 rounded-lg bg-surface-card border border-surface-border text-slate-400 hover:text-white transition-all"
                  title="Refresh rules"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRules ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowRuleModal(true)}
                  disabled={connectedRepos.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all shadow-md shadow-violet-500/20 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Rule
                </button>
              </div>
            </div>

            {connectedRepos.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>You must connect at least one repository before creating automation rules.</span>
              </div>
            )}

            {rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border p-8 text-center space-y-3">
                <Sliders className="h-8 w-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No Rules Configured</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Create a rule such as: When an issue is opened with &ldquo;bug&rdquo; in the title, add the GitHub &ldquo;bug&rdquo; label and notify Slack!
                </p>
                {connectedRepos.length > 0 && (
                  <button
                    onClick={() => setShowRuleModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Your First Rule
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-5 rounded-xl border border-surface-border bg-surface/60 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-surface-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{rule.repositoryName}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-card border border-surface-border text-blue-400">
                          EVENT: {rule.eventType}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            rule.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {rule.enabled ? 'ENABLED' : 'PAUSED'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                            rule.enabled
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20'
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {rule.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Conditions and Actions display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5 p-3 rounded-lg bg-surface-card/60 border border-surface-border/60">
                        <span className="text-[10px] uppercase font-mono text-slate-400">Condition (IF)</span>
                        {rule.conditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 font-mono text-slate-200">
                            <span className="text-violet-400">{cond.field}</span>
                            <span className="text-slate-500">{cond.operator}</span>
                            <span className="text-emerald-400">&ldquo;{cond.value}&rdquo;</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 p-3 rounded-lg bg-surface-card/60 border border-surface-border/60">
                        <span className="text-[10px] uppercase font-mono text-slate-400">Actions (THEN)</span>
                        <div className="flex flex-wrap gap-2">
                          {rule.actions.map((act, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-300 font-mono text-[11px]"
                            >
                              {act.type === 'github.add_label' && <Tag className="h-3 w-3 text-blue-400" />}
                              {act.type === 'github.comment' && <MessageSquare className="h-3 w-3 text-cyan-400" />}
                              {act.type === 'slack.notify' && <Bell className="h-3 w-3 text-amber-400" />}
                              <span>{act.type}</span>
                              {act.label && <span className="text-blue-300">({act.label})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: EVENT & ACTION LOGS */}
        {activeTab === 'events' && (
          <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-surface-border pb-4 gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-cyan-400" />
                  Live Event Ingestion & BotAction Audit Logs
                </h3>
                <p className="text-xs text-slate-400">
                  Every webhook delivery is idempotently verified, logged, and audited with attempt counts and errors
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchEvents}
                  disabled={isLoadingEvents}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-card border border-surface-border hover:border-blue-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                  Refresh Logs
                </button>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border p-8 text-center space-y-3">
                <History className="h-8 w-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No Events Received Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click the &ldquo;Simulate &apos;Bug&apos; Webhook&rdquo; button above to trigger an issue event and watch the rule engine and actions execute live!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => {
                  const isExpanded = expandedEventId === ev.id;
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-surface-border bg-surface/60 overflow-hidden transition-all"
                    >
                      <div
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-surface-card/40 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-slate-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white">{ev.repositoryName}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-cyan-400">
                                {ev.eventType} {ev.action ? `(${ev.action})` : ''}
                              </span>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                  ev.status === 'PROCESSED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : ev.status === 'FAILED'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {ev.status}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 pt-0.5">
                              Delivery ID: {ev.deliveryId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="font-mono text-[11px] text-slate-400">
                            {ev.actions.length} Action{ev.actions.length === 1 ? '' : 's'}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {new Date(ev.receivedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Expandable BotActions Details */}
                      {isExpanded && (
                        <div className="p-4 bg-surface-card/70 border-t border-surface-border space-y-3 text-xs">
                          <h5 className="font-semibold text-white text-[11px] uppercase tracking-wider font-mono">
                            Downstream Bot Actions Audit Trail
                          </h5>
                          {ev.actions.length === 0 ? (
                            <p className="text-slate-400 text-xs">No matching rules triggered actions for this event.</p>
                          ) : (
                            <div className="space-y-2">
                              {ev.actions.map((act) => (
                                <div
                                  key={act.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-surface/80 border border-surface-border/60"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {act.type === 'github.add_label' && <Tag className="h-4 w-4 text-blue-400" />}
                                    {act.type === 'github.comment' && <MessageSquare className="h-4 w-4 text-cyan-400" />}
                                    {act.type === 'slack.notify' && <Bell className="h-4 w-4 text-amber-400" />}
                                    <div>
                                      <p className="font-mono font-medium text-white text-xs">{act.type}</p>
                                      {act.error && (
                                        <p className="text-rose-400 text-[11px]">Error: {act.error}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Attempts: {act.attempts}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        act.status === 'SUCCESS'
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      }`}
                                    >
                                      {act.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Modal: Create Automation Rule */}
        {showRuleModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg rounded-2xl p-6 md:p-8 space-y-6 relative border border-slate-700 shadow-2xl">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-violet-400" />
                  Configure Automation Rule
                </h3>
                <p className="text-xs text-slate-400">
                  Define triggers, field matching conditions, and external actions.
                </p>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
                {/* Repository Selection */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Target Connected Repository</label>
                  <select
                    value={newRuleRepoId}
                    onChange={(e) => setNewRuleRepoId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs focus:border-violet-500 outline-none"
                    required
                  >
                    {connectedRepos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Type */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Event Type</label>
                  <select
                    value={newRuleEventType}
                    onChange={(e) => setNewRuleEventType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs focus:border-violet-500 outline-none"
                  >
                    <option value="issues">issues (Issue opened, labeled, edited)</option>
                    <option value="pull_request">pull_request (Pull Request opened, synchronized)</option>
                  </select>
                </div>

                {/* Condition Builder */}
                <div className="p-3.5 rounded-xl bg-surface/80 border border-surface-border space-y-3">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider font-mono">
                    Condition (IF)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newRuleField}
                      onChange={(e) => setNewRuleField(e.target.value)}
                      placeholder="Field (e.g. issue.title)"
                      className="p-2 rounded-lg bg-surface-card border border-surface-border text-white text-xs outline-none"
                      required
                    />
                    <select
                      value={newRuleOperator}
                      onChange={(e) => setNewRuleOperator(e.target.value as any)}
                      className="p-2 rounded-lg bg-surface-card border border-surface-border text-white text-xs outline-none"
                    >
                      <option value="contains">contains</option>
                      <option value="equals">equals</option>
                      <option value="starts_with">starts_with</option>
                    </select>
                    <input
                      type="text"
                      value={newRuleValue}
                      onChange={(e) => setNewRuleValue(e.target.value)}
                      placeholder="Value (e.g. bug)"
                      className="p-2 rounded-lg bg-surface-card border border-surface-border text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Actions Builder */}
                <div className="p-3.5 rounded-xl bg-surface/80 border border-surface-border space-y-3">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider font-mono">
                    Actions (THEN)
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="labelCheckbox"
                        checked={!!newRuleLabel}
                        onChange={(e) => setNewRuleLabel(e.target.checked ? 'bug' : '')}
                        className="rounded"
                      />
                      <label htmlFor="labelCheckbox" className="text-slate-300">
                        Add GitHub Label:
                      </label>
                      <input
                        type="text"
                        value={newRuleLabel}
                        onChange={(e) => setNewRuleLabel(e.target.value)}
                        placeholder="Label name (e.g. bug)"
                        className="p-1.5 rounded-lg bg-surface-card border border-surface-border text-white text-xs outline-none flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="slackCheckbox"
                        checked={newRuleSlack}
                        onChange={(e) => setNewRuleSlack(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="slackCheckbox" className="text-slate-300">
                        Send formatted Slack notification via Incoming Webhook
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRuleModal(false)}
                    className="px-4 py-2 rounded-xl bg-surface-card border border-surface-border text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-md shadow-violet-500/20"
                  >
                    Save & Activate Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
