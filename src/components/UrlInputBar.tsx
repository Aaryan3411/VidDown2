import React, { useState } from 'react';
import { Link2, Clipboard, ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { SAMPLE_VIDEOS } from '../utils';
import { SampleVideo } from '../types';

interface UrlInputBarProps {
  url: string;
  setUrl: (url: string) => void;
  onInspect: (customUrl?: string) => void;
  isLoading: boolean;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  url,
  setUrl,
  onInspect,
  isLoading,
}) => {
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handlePaste = async () => {
    setPasteError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const clean = text.trim();
          setUrl(clean);
          if (clean.startsWith('http://') || clean.startsWith('https://')) {
            onInspect(clean);
          }
        }
      } else {
        setPasteError('Clipboard access not supported in this browser context');
      }
    } catch {
      setPasteError('Please allow clipboard permission or paste manually');
    }
  };

  const handleSampleClick = (sample: SampleVideo) => {
    setUrl(sample.url);
    onInspect(sample.url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onInspect(url.trim());
  };

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white rounded-2xl border border-zinc-300 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <div className="relative flex-1 flex items-center min-w-0">
            <Link2 className="w-5 h-5 text-zinc-400 ml-3 shrink-0" />
            <input
              id="video-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any video URL (e.g. https://.../video.mp4, webm, or media link)"
              required
              className="w-full pl-3 pr-16 py-2.5 text-sm sm:text-base text-zinc-900 bg-transparent placeholder-zinc-400 focus:outline-hidden"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md transition-colors"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-paste-clipboard"
              onClick={handlePaste}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors ml-1 mr-2"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Paste</span>
            </button>
          </div>

          <button
            type="submit"
            id="btn-inspect-video"
            disabled={isLoading || !url.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inspecting...</span>
              </>
            ) : (
              <>
                <span>Fetch Video</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {pasteError && (
        <p className="text-xs text-amber-600 px-2">{pasteError}</p>
      )}

      {/* Quick Test Samples */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="flex items-center gap-1 text-xs font-semibold text-zinc-500 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Try quick sample:</span>
        </div>
        {SAMPLE_VIDEOS.map((sample) => (
          <button
            key={sample.title}
            type="button"
            onClick={() => handleSampleClick(sample)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100/80 hover:bg-zinc-200/90 text-zinc-700 rounded-lg border border-zinc-200/80 transition-colors"
          >
            <span>{sample.title}</span>
            <span className="text-[10px] text-zinc-400 font-mono">({sample.format})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
