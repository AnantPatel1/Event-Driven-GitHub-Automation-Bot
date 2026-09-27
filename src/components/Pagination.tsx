"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  itemName = "records",
  isLoading = false,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate visible page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Always include page 1
    pages.push(1);

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    // Window around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-1 text-xs text-[#656d76] select-none">
      {/* Item count text */}
      <div className="flex items-center gap-2">
        <span>
          Showing <span className="font-semibold text-[#1f2328] font-mono">{startItem}</span>
          –<span className="font-semibold text-[#1f2328] font-mono">{endItem}</span> of{" "}
          <span className="font-semibold text-[#1f2328] font-mono">{totalItems}</span> {itemName}
        </span>

        {/* Page size dropdown */}
        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-[#d0d7de] pl-3">
            <span className="text-[11px] text-[#656d76]">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="text-xs bg-white border border-[#d0d7de] rounded px-1.5 py-0.5 text-[#1f2328] focus:border-[#0969da] outline-none font-mono cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page navigation controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous page"
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f6f8fa] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-[#656d76] font-mono select-none"
                >
                  …
                </span>
              );
            }

            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                className={`min-w-[28px] h-7 px-1.5 text-xs rounded font-mono transition-colors border ${
                  isActive
                    ? "bg-[#0969da] text-white border-[#0969da] font-bold shadow-xs"
                    : "bg-white text-[#1f2328] hover:bg-[#f6f8fa] border-[#d0d7de]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Next page"
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f6f8fa] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
