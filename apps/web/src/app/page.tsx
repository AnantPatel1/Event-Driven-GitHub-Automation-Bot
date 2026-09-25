'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  CheckCircle2,
  Database,
  GitBranch,
  Github,
  Radio,
  Server,
  ShieldCheck,
  Zap,
  RefreshCw,
  Sliders,
  Bell,
  Sparkles,
  ArrowRight,
  LogOut,
  User,
} from 'lucide-react';

interface ServiceHealth {
  status: 'ok' | 'degraded' | 'error' | 'checking';
  service?: string;
  uptimeSeconds?: number;
  database?: string;
  timestamp?: string;
  environment?: string;
}

export default function Home() {
  const { user, isAuthenticated, loading: authLoading, loginWithGitHub, loginDev, logout } = useAuth();
  const [frontendHealth, setFrontendHealth] = useState<ServiceHealth>({ status: 'checking' });
  const [backendHealth, setBackendHealth] = useState<ServiceHealth>({ status: 'checking' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setIsRefreshing(true);
    // Check Frontend Health
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setFrontendHealth(data);
      } else {
        setFrontendHealth({ status: 'error' });
      }
    } catch {
      setFrontendHealth({ status: 'error' });
    }

    // Check Backend Health
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'error' });
      }
    } catch {
      setBackendHealth({ status: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-cyan-500/20 blur-[130px] -z-10 rounded-full pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-surface-border mb-12 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Radio className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              GitHub Automation Engine
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 2 Verified
              </span>
            </h1>
            <p className="text-xs text-slate-400">Production-grade event orchestration & rule automation</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="refresh-health-btn"
            onClick={checkHealth}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-card border border-surface-border hover:border-blue-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {authLoading ? (
            <div className="h-8 w-24 bg-surface-card rounded-lg animate-pulse" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-card border border-surface-border text-xs">
                <span className="font-semibold text-white">@{user.githubUsername}</span>
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={loginWithGitHub}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                <Github className="h-3.5 w-3.5" />
                Sign in with GitHub
              </button>
              <button
                onClick={() => loginDev('test-user')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-surface-card border border-surface-border hover:border-slate-500 text-slate-300 hover:text-white transition-all"
                title="Quick Dev Login for offline testing"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Dev Login
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Content */}
      <main className="w-full max-w-6xl space-y-10">
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Phase 2: GitHub OAuth & Secure Session Layer Active
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400">
            Real-Time GitHub Event Automation & Orchestration
          </h2>
          <p className="text-base text-slate-400">
            Idempotent webhook ingestion, cryptographic HMAC verification, dynamic rule evaluation, automated GitHub labels & comments, and Slack operational alerting.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25"
              >
                Open Protected Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={loginWithGitHub}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25"
              >
                <Github className="h-4 w-4" />
                Authenticate to Get Started
              </button>
            )}
          </div>
        </section>

        {/* Live Service Health Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Frontend Service */}
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Frontend Web App</h3>
                  <p className="text-xs text-slate-400">Next.js 15 App Router</p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  frontendHealth.status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {frontendHealth.status === 'ok' ? 'HEALTHY' : 'PENDING'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-surface-border">
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="font-mono text-slate-200">3000</span>
              </div>
              <div className="flex justify-between">
                <span>Health Endpoint:</span>
                <span className="font-mono text-blue-400">/api/health</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-mono text-emerald-400">{frontendHealth.status}</span>
              </div>
            </div>
          </div>

          {/* Backend Service */}
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Automation Server</h3>
                  <p className="text-xs text-slate-400">Fastify TypeScript API</p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  backendHealth.status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {backendHealth.status === 'ok' ? 'HEALTHY' : 'CONNECTING'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-surface-border">
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="font-mono text-slate-200">4000</span>
              </div>
              <div className="flex justify-between">
                <span>Health Endpoint:</span>
                <span className="font-mono text-violet-400">/health</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-mono text-slate-200">{backendHealth.uptimeSeconds ?? 0}s</span>
              </div>
            </div>
          </div>

          {/* Database Service */}
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">PostgreSQL + Prisma</h3>
                  <p className="text-xs text-slate-400">Idempotency & Event Store</p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  backendHealth.database === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {backendHealth.database === 'connected' ? 'CONNECTED' : 'CONNECTING'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-surface-border">
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="font-mono text-slate-200">5433 (mapped)</span>
              </div>
              <div className="flex justify-between">
                <span>Engine:</span>
                <span className="font-mono text-cyan-400">Prisma ORM v6</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery ID Uniqueness:</span>
                <span className="font-mono text-emerald-400">Enforced</span>
              </div>
            </div>
          </div>
        </section>

        {/* System Architecture Flow Visualizer */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-400" />
                Event Processing Pipeline Architecture
              </h3>
              <p className="text-xs text-slate-400">End-to-end data pipeline from GitHub event to external action executions</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { step: '01', title: 'GitHub OAuth', desc: 'Secure user login & repo access tokens', icon: Github, active: true },
              { step: '02', title: 'Webhook Ingest', desc: 'HMAC SHA-256 constant-time verification', icon: ShieldCheck, active: false },
              { step: '03', title: 'Idempotency', desc: 'Enforce deliveryId unique constraint', icon: Database, active: false },
              { step: '04', title: 'Rule Engine', desc: 'Configurable conditions & field matching', icon: Sliders, active: false },
              { step: '05', title: 'Actions', desc: 'GitHub label/comment + Slack notifications', icon: Bell, active: false },
              { step: '06', title: 'Dashboard', desc: 'Real-time telemetry, audit logs & retry state', icon: Zap, active: false },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`bg-surface/60 border rounded-xl p-3.5 space-y-2 relative ${
                  item.active ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-surface-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{item.step}</span>
                  {item.active && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      LIVE
                    </span>
                  )}
                </div>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-border/60 text-blue-400'}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Phase Verification Checklist */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Phase 2 Deliverables & Verification Checklist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">GitHub OAuth initiation endpoint (<code>GET /auth/github</code>) with CSRF state</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">OAuth Callback handler (<code>GET /auth/github/callback</code>) with code exchange & user upsert</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">Cryptographically signed httpOnly session cookie with zero client secret exposure</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">Current user endpoint (<code>GET /auth/me</code>) omitting sensitive access tokens</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">Logout endpoint (<code>POST /auth/logout</code>) with cookie revocation</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/50 border border-surface-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">Protected Frontend Dashboard (<code>/dashboard</code>) blocking unauthorized users</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mt-12 pt-6 border-t border-surface-border text-center text-xs text-slate-500">
        GitHub Automation Bot System &bull; Phase 2 Complete &bull; Ready for Phase 3 (Repository Connection)
      </footer>
    </div>
  );
}
