"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Terminal, LogOut } from "lucide-react";
import type { AuthUser } from "@github-bot/shared";

interface DashboardHeaderProps {
  user: AuthUser;
  onOpenSandbox: () => void;
  onLogout: () => void;
}

export function DashboardHeader({
  user,
  onOpenSandbox,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <header className="w-full border-b border-[#d0d7de] bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[#656d76] hover:text-[#1f2328] transition-colors"
            title="Return to Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-[#1f2328]">
              GitHub Automation
            </span>
            <span className="text-[#d0d7de]">/</span>
            <span className="text-xs text-[#656d76] font-medium">Console</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f6f8fa] border border-[#d0d7de] text-[10px] text-[#656d76] font-mono ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1a7f37]" />
            <span>Ingestion Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSandbox}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-[#d0d7de] hover:bg-[#f3f4f6] text-[#1f2328] transition-colors shadow-xs"
            title="Open Webhook Testing Sandbox"
          >
            <Terminal className="h-3 w-3 text-[#0969da]" />
            <span className="hidden sm:inline">Webhook Sandbox</span>
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-[#d0d7de]">
            <div className="h-7 w-7 rounded-md bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center text-xs font-bold text-[#1f2328] uppercase font-mono">
              {user.githubUsername.slice(0, 2)}
            </div>
            <span className="text-xs font-medium text-[#1f2328] hidden md:inline font-mono">
              @{user.githubUsername}
            </span>
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1 text-[#656d76] hover:text-[#cf222e] transition-colors ml-1"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
