import Link from 'next/link';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      <div className="h-14 w-14 rounded-lg bg-white border border-[#d0d7de] flex items-center justify-center text-[#656d76] shadow-xs">
        <GitBranch className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-[#1f2328] font-mono">404: Route Not Found</h2>
      <p className="text-xs text-[#656d76] max-w-sm">
        The requested path does not exist on this GitHub Automation Bot instance.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-md bg-white border border-[#d0d7de] text-[#1f2328] hover:bg-[#f3f4f6] transition-colors shadow-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Return to Home
      </Link>
    </div>
  );
}
