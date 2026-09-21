/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UrlInputBar } from './components/UrlInputBar';
import { VideoPreviewCard } from './components/VideoPreviewCard';
import { HtmlCandidatesView } from './components/HtmlCandidatesView';
import { BatchDownloader } from './components/BatchDownloader';
import { DownloadHistory } from './components/DownloadHistory';
import { HowToGuide } from './components/HowToGuide';
import { VideoProbeResult, DownloadHistoryItem } from './types';
import {
  extractClientFilename,
  inferVideoContentType,
  extractYouTubeId,
  fetchYouTubeMetadata,
  sanitizeFilename,
} from './utils';
import { AlertCircle, CheckCircle2, ShieldCheck, Zap, Video, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'video_url_downloader_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'history' | 'guide'>('single');
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<VideoProbeResult | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // storage full or disabled
    }
  }, [history]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleInspect = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || url).trim();
    if (!rawUrl) return;

    setIsLoading(true);
    setError(null);
    setProbeResult(null);

    // 1. Check if the URL is a YouTube link
    const ytId = extractYouTubeId(rawUrl);
    if (ytId) {
      try {
        const meta = await fetchYouTubeMetadata(ytId);
        const title = meta?.title || `YouTube Video (${ytId})`;
        const filename = sanitizeFilename(title, 'mp4');

        const ytResult: VideoProbeResult = {
          url: `https://www.youtube.com/watch?v=${ytId}`,
          isHtmlPage: false,
          isYouTube: true,
          youTubeId: ytId,
          title,
          author: meta?.author || 'YouTube Channel',
          thumbnailUrl: meta?.thumbnailUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          embedUrl: meta?.embedUrl || `https://www.youtube.com/embed/${ytId}?autoplay=0`,
          filename,
          contentType: 'video/mp4',
          sizeBytes: null,
          acceptRanges: true,
          host: 'www.youtube.com',
        };

        setProbeResult(ytResult);
        showToast('YouTube video loaded: in-app player and standalone tools ready', 'info');
        setIsLoading(false);
        return;
      } catch {
        // Continue to server/direct probe if oembed fails
      }
    }

    let serverData: VideoProbeResult | null = null;
    let serverFailed = false;

    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: rawUrl }),
      });

      if (res.ok) {
        serverData = await res.json();
      } else {
        serverFailed = true;
      }
    } catch {
      // Backend not running (e.g. GitHub Pages static host)
      serverFailed = true;
    }

    if (serverData && !serverData.error) {
      setProbeResult(serverData);
      if (serverData.isHtmlPage && serverData.candidates?.length === 0) {
        showToast('Webpage parsed, but no direct video tags detected.', 'info');
      } else {
        showToast('Video details detected successfully!', 'success');
      }
      setIsLoading(false);
      return;
    }

    // Static Client-Side Fallback (for GitHub Pages and direct file links)
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Please enter a valid HTTP or HTTPS URL.');
      }

      const filename = extractClientFilename(rawUrl);
      const contentType = inferVideoContentType(parsed.pathname);

      const fallbackResult: VideoProbeResult = {
        url: rawUrl,
        isHtmlPage: false,
        contentType,
        filename,
        sizeBytes: null,
        acceptRanges: true,
        host: parsed.hostname,
      };

      setProbeResult(fallbackResult);
      showToast('Video details loaded (Direct Mode)', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Please enter a valid HTTP or HTTPS video URL.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadStarted = (
    filename: string,
    downloadUrl: string,
    sizeBytes: number | null,
    contentType: string
  ) => {
    const newItem: DownloadHistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: downloadUrl,
      filename,
      sizeBytes,
      contentType,
      timestamp: Date.now(),
    };

    setHistory((prev) => [newItem, ...prev.filter((i) => i.url !== downloadUrl)].slice(0, 50));
    showToast(`Downloading "${filename}"...`, 'success');
  };

  const handleSelectCandidate = (candidateUrl: string) => {
    setUrl(candidateUrl);
    handleInspect(candidateUrl);
  };

  const handleDownloadCandidate = (candidateUrl: string, label: string) => {
    const ext = candidateUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const cleanFilename = `${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
    handleDownloadStarted(cleanFilename, candidateUrl, null, 'video/mp4');
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your download history?')) {
      setHistory([]);
      showToast('Download history cleared', 'info');
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce-short">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toast.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : 'bg-zinc-900 text-white border-zinc-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {activeTab === 'single' && (
          <div className="space-y-8">
            {/* Title / Description */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
                Download Video from URL
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                Paste any direct video link or webpage with embedded media. Inspect metadata, preview in real time, and download directly to your computer.
              </p>
            </div>

            {/* URL Input Bar */}
            <div className="max-w-3xl mx-auto">
              <UrlInputBar
                url={url}
                setUrl={setUrl}
                onInspect={handleInspect}
                isLoading={isLoading}
              />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="max-w-3xl mx-auto p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Unable to fetch video</p>
                  <p className="text-xs text-red-700">{error}</p>
                  <p className="text-xs text-red-600 pt-1">
                    Tip: Ensure the link is accessible over the public web and points to a video stream or page with video tags.
                  </p>
                </div>
              </div>
            )}

            {/* Video Result View */}
            {probeResult && !isLoading && (
              <div className="max-w-4xl mx-auto pt-2">
                {probeResult.isHtmlPage ? (
                  <HtmlCandidatesView
                    result={probeResult}
                    onSelectCandidate={handleSelectCandidate}
                    onDownloadCandidate={handleDownloadCandidate}
                  />
                ) : (
                  <VideoPreviewCard
                    video={probeResult}
                    onDownloadStarted={handleDownloadStarted}
                    onLoadDirectSample={(sampleUrl) => {
                      setUrl(sampleUrl);
                      handleInspect(sampleUrl);
                    }}
                  />
                )}
              </div>
            )}

            {/* Empty State / Feature Highlights (when no video probed yet) */}
            {!probeResult && !isLoading && (
              <div className="pt-8 border-t border-zinc-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-sm">Streamlined Direct Proxy</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Downloads are piped directly as attachments, bypassing browser CORS blocking and preventing video from merely opening in a tab.
                    </p>
                  </div>

                  <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Video className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-sm">In-Browser Video Preview</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Watch and scrub through the video before saving. View format container, dimensions, duration, and approximate file size.
                    </p>
                  </div>

                  <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-sm">Custom File Renaming</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Easily rename the video before triggering download without needing command-line tools or external converters.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="max-w-4xl mx-auto">
            <BatchDownloader onDownloadStarted={handleDownloadStarted} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <DownloadHistory
              history={history}
              onClearHistory={handleClearHistory}
              onRemoveItem={handleRemoveHistoryItem}
            />
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto">
            <HowToGuide />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700">Video URL Downloader</span>
            <span>•</span>
            <span>Supports MP4, WebM, MOV, MKV, OGV & Embedded Media</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-zinc-900 transition-colors"
            >
              How it works
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className="hover:text-zinc-900 transition-colors"
            >
              Batch Queue
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="hover:text-zinc-900 transition-colors"
            >
              History
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
