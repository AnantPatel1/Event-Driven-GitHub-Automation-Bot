"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  RefreshCw,
  FolderGit2,
  Lock,
  Globe,
  Sliders,
} from "lucide-react";
import type { RepositoryItem } from "@github-bot/shared";
import { apiFetch } from "../../lib/api";
import { Pagination } from "../Pagination";

interface RepositoriesTabProps {
  onStatusMessage: (msg: { type: "success" | "error" | "warning"; text: string } | null) => void;
  onReposLoaded?: (repos: RepositoryItem[]) => void;
}

export function RepositoriesTab({
  onStatusMessage,
  onReposLoaded,
}: RepositoriesTabProps) {
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [repoPage, setRepoPage] = useState(1);
  const [repoPageSize, setRepoPageSize] = useState(8);

  const fetchRepositories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ repositories: RepositoryItem[] }>("/repositories");
      if (res.ok && res.data) {
        const repos = res.data.repositories || [];
        setRepositories(repos);
        onReposLoaded?.(repos);
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to synchronize repositories from GitHub API.",
        });
      }
    } catch {
      onStatusMessage({
        type: "error",
        text: "Network error loading repositories.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onReposLoaded, onStatusMessage]);

  // Fetch ONLY when this component mounts!
  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Connect repository
  const handleConnect = async (repoId: string, repoName: string) => {
    setActionLoadingId(repoId);
    onStatusMessage(null);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>(
        `/repositories/${repoId}/connect`,
        { method: "POST" }
      );
      if (res.ok && res.data?.success) {
        onStatusMessage({
          type: "success",
          text: `Connected ${repoName}. Webhook subscription registered.`,
        });
        await fetchRepositories();
      } else {
        onStatusMessage({
          type: "error",
          text: res.data?.error || "Failed to connect repository",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Disconnect repository
  const handleDisconnect = async (repoIdOrDbId: string, repoName: string) => {
    setActionLoadingId(repoIdOrDbId);
    onStatusMessage(null);
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/repositories/${repoIdOrDbId}/disconnect`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onStatusMessage({
          type: "warning",
          text: `Disconnected ${repoName}. Remote webhook deleted.`,
        });
        await fetchRepositories();
      } else {
        onStatusMessage({
          type: "error",
          text: "Failed to disconnect repository",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered repositories & pagination
  const filteredRepositories = useMemo(() => {
    if (!repoSearch.trim()) return repositories;
    const term = repoSearch.toLowerCase();
    return repositories.filter(
      (r) =>
        r.fullName.toLowerCase().includes(term) ||
        (r.description && r.description.toLowerCase().includes(term))
    );
  }, [repositories, repoSearch]);

  const totalRepoPages = Math.ceil(filteredRepositories.length / repoPageSize) || 1;
  const paginatedRepositories = useMemo(() => {
    const start = (repoPage - 1) * repoPageSize;
    return filteredRepositories.slice(start, start + repoPageSize);
  }, [filteredRepositories, repoPage, repoPageSize]);

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#656d76]" />
          <input
            type="text"
            value={repoSearch}
            onChange={(e) => {
              setRepoSearch(e.target.value);
              setRepoPage(1);
            }}
            placeholder="Filter by repository name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white border border-[#d0d7de] text-[#1f2328] focus:border-[#0969da] outline-none font-mono"
          />
        </div>

        <button
          onClick={fetchRepositories}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white border border-[#d0d7de] text-[#1f2328] hover:bg-[#f3f4f6] transition-colors shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Repositories</span>
        </button>
      </div>

      {/* Main Content */}
      {isLoading && repositories.length === 0 ? (
        <div className="panel rounded-md p-10 text-center space-y-3 bg-white border border-[#d0d7de]">
          <div className="h-5 w-5 border-2 border-[#0969da] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#656d76] font-mono">
            Synchronizing repository list from GitHub...
          </p>
        </div>
      ) : filteredRepositories.length === 0 ? (
        <div className="panel rounded-md p-10 text-center space-y-2 bg-white border border-[#d0d7de]">
          <FolderGit2 className="h-7 w-7 text-[#656d76] mx-auto" />
          <p className="text-xs font-semibold text-[#1f2328]">
            No repositories found
          </p>
          <p className="text-xs text-[#656d76] max-w-sm mx-auto">
            {repoSearch
              ? "No repositories match your filter query."
              : "No accessible repositories found in your GitHub account."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="panel rounded-md divide-y divide-[#d0d7de] overflow-hidden bg-white border border-[#d0d7de]">
            <div className="px-4 py-2 bg-[#f6f8fa] flex items-center justify-between text-[11px] font-mono uppercase text-[#656d76] tracking-wider border-b border-[#d0d7de]">
              <span>Repository</span>
              <span>Webhook Status</span>
            </div>
            {paginatedRepositories.map((repo) => {
              const actionLoading =
                actionLoadingId === repo.githubRepositoryId ||
                actionLoadingId === repo.id;
              return (
                <div
                  key={repo.githubRepositoryId}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#f6f8fa]/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#1f2328] font-mono">
                        {repo.fullName}
                      </span>
                      {repo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-[#656d76] border border-[#d0d7de]">
                          <Lock className="h-2.5 w-2.5" /> Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-[#656d76] border border-[#d0d7de]">
                          <Globe className="h-2.5 w-2.5" /> Public
                        </span>
                      )}
                      {repo.isConnected && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active Webhook
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#656d76] line-clamp-1">
                      {repo.description || "No description provided"}
                    </p>
                    {repo.isConnected && (
                      <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-[#656d76]">
                        <span className="flex items-center gap-1">
                          <Sliders className="h-3 w-3 text-[#0969da]" />
                          {repo.ruleCount} rule(s) configured
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {repo.isConnected ? (
                      <button
                        onClick={() =>
                          handleDisconnect(
                            repo.id || repo.githubRepositoryId,
                            repo.fullName
                          )
                        }
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-md bg-white border border-[#d0d7de] hover:bg-rose-50 hover:text-[#cf222e] hover:border-rose-300 text-xs font-medium text-[#1f2328] transition-colors shadow-xs disabled:opacity-50 font-mono"
                      >
                        {actionLoading ? "Disconnecting..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleConnect(
                            repo.githubRepositoryId,
                            repo.fullName
                          )
                        }
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 rounded-md bg-[#1f883d] hover:bg-[#1a7f37] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                      >
                        {actionLoading ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={repoPage}
            totalPages={totalRepoPages}
            totalItems={filteredRepositories.length}
            pageSize={repoPageSize}
            onPageChange={(page) => setRepoPage(page)}
            onPageSizeChange={(size) => {
              setRepoPageSize(size);
              setRepoPage(1);
            }}
            pageSizeOptions={[8, 16, 24]}
            itemName="repositories"
          />
        </div>
      )}
    </div>
  );
}
