import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center text-slate-400">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-white">Page Not Found</h2>
      <p className="text-xs text-slate-400 max-w-sm">
        The requested page could not be located on the GitHub Automation Bot server.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-slate-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Return Home
      </Link>
    </div>
  );
}
