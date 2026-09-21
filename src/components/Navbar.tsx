import React from 'react';
import { DownloadCloud, Layers, History, HelpCircle, Film } from 'lucide-react';

interface NavbarProps {
  activeTab: 'single' | 'batch' | 'history' | 'guide';
  setActiveTab: (tab: 'single' | 'batch' | 'history' | 'guide') => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
}) => {
  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setActiveTab('single')}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 text-lg tracking-tight">
                Video URL Downloader
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Direct Stream
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Fetch, preview, and save videos from direct URLs
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            id="nav-tab-single"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'single'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Downloader</span>
          </button>

          <button
            id="nav-tab-batch"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'batch'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Batch Mode</span>
          </button>

          <button
            id="nav-tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  activeTab === 'history'
                    ? 'bg-white text-zinc-900'
                    : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {historyCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-guide"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'guide'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="How to find direct video URLs"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
