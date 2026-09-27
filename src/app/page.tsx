'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  GitBranch,
  Sliders,
  History,
  CheckCircle2,
  ShieldCheck,
  Bell,
  Tag,
  MessageSquare,
  Lock,
  GitPullRequest,
  ExternalLink,
  Zap,
  FolderGit2,
  Sparkles,
  Workflow,
  Check,
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, loginWithGitHub } = useAuth();

  // If user is already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, router]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      {/* Top Application Header Bar */}
      <header className="w-full border-b border-[#d0d7de] bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center text-[#1f2328]">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-[#1f2328]">GitHub Automation</span>
              <span className="text-[#d0d7de]">/</span>
              <span className="text-xs text-[#656d76]">Repository Workflow Platform</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f6f8fa] border border-[#d0d7de] text-[11px] text-[#656d76]">
              <span className="h-2 w-2 rounded-full bg-[#1a7f37] animate-pulse" />
              <span>Ingestion Gateway Online</span>
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white transition-colors shadow-xs"
              >
                <span>Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                onClick={loginWithGitHub}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#1f2328] hover:bg-[#24292f] text-white transition-colors shadow-xs"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>Connect with GitHub</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-14">
        {/* Hero Section */}
        <section className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-[#d0d7de] text-[#656d76] text-xs font-mono">
            <span>REPOSITORY EVENT ORCHESTRATION</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1f2328] leading-tight">
            Automate GitHub Issue Triage, Labeling & Team Alerts
          </h1>

          <p className="text-sm text-[#656d76] leading-relaxed">
            Connect your repositories to listen for real-time issues and pull request events. Evaluate custom trigger rules, run automated Google Gemini 1.5 Flash AI triage to auto-summarize and prioritize, automatically apply labels, post guidance comments, and dispatch encrypted alerts to team Slack channels with guaranteed idempotency and cryptographic signature verification.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0969da] hover:bg-[#0550ae] text-white font-semibold text-xs shadow-xs transition-colors"
              >
                <span>Open Automation Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                onClick={loginWithGitHub}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1f2328] hover:bg-[#24292f] text-white font-semibold text-xs shadow-xs transition-colors"
              >
                <GitBranch className="h-4 w-4" />
                <span>Sign in with GitHub (OAuth)</span>
              </button>
            )}

            <a
              href="#what-it-does"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-[#d0d7de] hover:bg-[#f3f4f6] text-[#1f2328] font-medium text-xs transition-colors"
            >
              <span>Learn What This Platform Does</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#0969da]" />
            </a>
          </div>
        </section>

        {/* SECTION: WHAT THIS PLATFORM DOES */}
        <section id="what-it-does" className="space-y-6">
          <div className="pb-2 border-b border-[#d0d7de]">
            <h2 className="text-xl font-bold text-[#1f2328] flex items-center gap-2">
              <Workflow className="h-5 w-5 text-[#0969da]" />
              What This Platform Does
            </h2>
            <p className="text-xs text-[#656d76] mt-1">
              Everything you need to automate repository management, contributor triage, and incident awareness.
            </p>
          </div>

          {/* Core Feature Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Automated Webhook Provisioning */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0969da]">
                <FolderGit2 className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">1. Connects to Your Repositories</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                Authenticates with your GitHub account via OAuth, lists all repositories where you have administrative access, and automatically creates webhook subscriptions for issue and pull request events with zero manual configuration.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> One-click repository connection
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Auto-provisions webhook secrets
                </li>
              </ul>
            </div>

            {/* 2. Intelligent Trigger Rules */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-[#8250df]">
                <Sliders className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">2. Evaluates Custom Triage Rules</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                Inspects incoming issue and pull request data against configurable conditions. Match on titles, descriptions, author logins, or branch references using operators like <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">contains</code>, <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">equals</code>, or <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">starts_with</code>.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Flexible IF/THEN condition builder
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Case-insensitive matching
                </li>
              </ul>
            </div>

            {/* 3. Automatic Label Assignment */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-[#1a7f37]">
                <Tag className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">3. Auto-Applies Labels</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                When an issue or pull request matches your criteria, the bot immediately calls GitHub&apos;s REST API to apply categorized labels (such as &ldquo;bug&rdquo;, &ldquo;priority:critical&rdquo;, or &ldquo;needs-triage&rdquo;) to keep your repository tracker organized.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Instant issue label synchronization
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Eliminates manual issue tagging
                </li>
              </ul>
            </div>

            {/* 4. Automated Contributor Comments */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-[#9a6700]">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">4. Posts Contextual Comments</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                Posts automated response comments to guide external contributors, provide issue template requirements, or post checklist reminders whenever pull requests target specific branches.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Contributor guidance replies
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Standardizes response workflows
                </li>
              </ul>
            </div>

            {/* 5. Per-User Encrypted Slack Alerts */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#0550ae]">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">5. Sends Team Slack Alerts</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                Dispatches formatted operational alert cards to your Slack channels via Incoming Webhooks. Includes issue titles, numbers, repository scope, and direct links so engineering teams can respond to critical bugs immediately.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> AES-256-GCM encrypted at rest
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Repository-scoped or default channels
                </li>
              </ul>
            </div>

            {/* 6. Security, Deduplication & Audit Logs */}
            <div className="panel rounded-lg p-5 space-y-3 bg-white border border-[#d0d7de]">
              <div className="h-9 w-9 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-[#cf222e]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-bold text-[#1f2328]">6. Guarantees Zero Duplicate Actions</h3>
              <p className="text-xs text-[#656d76] leading-relaxed">
                Every inbound payload is verified cryptographically with HMAC-SHA256 constant-time comparison. Uniqueness constraints on deliveryId prevent network replays from triggering duplicate actions, with a full audit log of every attempt.
              </p>
              <ul className="text-[11px] text-[#656d76] space-y-1 font-mono pt-1 border-t border-[#e1e4e8]">
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Cryptographic HMAC-SHA256 check
                </li>
                <li className="flex items-center gap-1.5 text-[#1a7f37]">
                  <Check className="h-3 w-3" /> Strict deliveryId deduplication
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION: COMMON AUTOMATION WORKFLOWS */}
        <section className="space-y-6">
          <div className="pb-2 border-b border-[#d0d7de]">
            <h2 className="text-xl font-bold text-[#1f2328]">
              Common Workflows You Can Automate
            </h2>
            <p className="text-xs text-[#656d76] mt-1">
              Real-world triage and notification patterns supported out-of-the-box:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenario 1 */}
            <div className="panel rounded-lg p-4 bg-white border border-[#d0d7de] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1f2328]">Critical Bug Triage & Notification</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-[#0969da] border border-blue-200">
                  Event: issues.opened
                </span>
              </div>
              <p className="text-xs text-[#656d76]">
                When an issue title contains <code className="font-mono text-[#0969da]">&ldquo;bug&rdquo;</code> or <code className="font-mono text-[#0969da]">&ldquo;crash&rdquo;</code>:
              </p>
              <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#e1e4e8] font-mono text-[11px] space-y-1">
                <div className="text-[#1a7f37]">✓ Adds GitHub label: &ldquo;bug&rdquo;</div>
                <div className="text-[#0969da]">✓ Dispatches alert to Slack channel #dev-oncall</div>
              </div>
            </div>

            {/* Scenario 2 */}
            <div className="panel rounded-lg p-4 bg-white border border-[#d0d7de] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1f2328]">Security Vulnerability Escalation</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-[#8250df] border border-purple-200">
                  Event: issues.opened
                </span>
              </div>
              <p className="text-xs text-[#656d76]">
                When an issue title contains <code className="font-mono text-[#8250df]">&ldquo;vulnerability&rdquo;</code> or <code className="font-mono text-[#8250df]">&ldquo;CVE&rdquo;</code>:
              </p>
              <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#e1e4e8] font-mono text-[11px] space-y-1">
                <div className="text-[#1a7f37]">✓ Adds GitHub label: &ldquo;security&rdquo;</div>
                <div className="text-[#0969da]">✓ Dispatches high-priority card to #security-alerts</div>
              </div>
            </div>

            {/* Scenario 3 */}
            <div className="panel rounded-lg p-4 bg-white border border-[#d0d7de] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1f2328]">Pull Request Reviewer Checklist</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-50 text-[#1a7f37] border border-green-200">
                  Event: pull_request.opened
                </span>
              </div>
              <p className="text-xs text-[#656d76]">
                When a pull request is submitted with title prefix <code className="font-mono text-[#1a7f37]">&ldquo;fix:&rdquo;</code>:
              </p>
              <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#e1e4e8] font-mono text-[11px] space-y-1">
                <div className="text-[#1a7f37]">✓ Adds GitHub label: &ldquo;review-needed&rdquo;</div>
                <div className="text-[#0969da]">✓ Posts guidance comment verifying tests pass</div>
              </div>
            </div>

            {/* Scenario 4 */}
            <div className="panel rounded-lg p-4 bg-white border border-[#d0d7de] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1f2328]">Release & Staging Branch Alerts</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-[#9a6700] border border-amber-200">
                  Event: pull_request.opened
                </span>
              </div>
              <p className="text-xs text-[#656d76]">
                When a PR targets base branch <code className="font-mono text-[#9a6700]">&ldquo;release&rdquo;</code>:
              </p>
              <div className="p-2.5 rounded bg-[#f6f8fa] border border-[#e1e4e8] font-mono text-[11px] space-y-1">
                <div className="text-[#1a7f37]">✓ Adds GitHub label: &ldquo;release-candidate&rdquo;</div>
                <div className="text-[#0969da]">✓ Alerts #release-management Slack channel</div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported GitHub Events Reference */}
        <section className="space-y-4">
          <div className="pb-2 border-b border-[#d0d7de]">
            <h2 className="text-xl font-bold text-[#1f2328]">
              Supported Event Triggers & Actions
            </h2>
            <p className="text-xs text-[#656d76] mt-1">
              Events received via webhook and actions dispatched automatically:
            </p>
          </div>

          <div className="panel rounded-lg overflow-hidden border border-[#d0d7de] bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f6f8fa] border-b border-[#d0d7de] text-[#656d76] font-mono uppercase text-[11px]">
                  <th className="py-2.5 px-4">Webhook Event</th>
                  <th className="py-2.5 px-4">Actions Supported</th>
                  <th className="py-2.5 px-4">Filterable Payload Fields</th>
                  <th className="py-2.5 px-4">Downstream Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d0d7de] font-mono text-[11px]">
                <tr className="hover:bg-[#f6f8fa]/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#1f2328]">issues</td>
                  <td className="py-3 px-4 text-[#656d76]">opened, labeled, edited</td>
                  <td className="py-3 px-4 text-[#0969da]">issue.title, issue.body, issue.user.login</td>
                  <td className="py-3 px-4 text-[#1a7f37]">Add labels, post issue comments, Slack alerts</td>
                </tr>
                <tr className="hover:bg-[#f6f8fa]/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#1f2328]">pull_request</td>
                  <td className="py-3 px-4 text-[#656d76]">opened, synchronized, closed</td>
                  <td className="py-3 px-4 text-[#0969da]">pull_request.title, pull_request.head.ref</td>
                  <td className="py-3 px-4 text-[#1a7f37]">Add labels, review checklist comments, Slack alerts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Light Mode Application Footer */}
      <footer className="w-full border-t border-[#d0d7de] mt-auto py-6 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#656d76] gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1f2328]">GitHub Automation Platform</span>
            <span>&bull;</span>
            <span>Repository Event Orchestration</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#656d76] hover:text-[#1f2328] transition-colors">
              Console
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-[#656d76] hover:text-[#1f2328] transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
