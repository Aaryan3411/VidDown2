import React, { useState } from 'react';
import { Layers, Download, Play, Check, AlertCircle, Loader2, Trash2, Plus } from 'lucide-react';
import { BatchItem } from '../types';
import { formatBytes, SAMPLE_VIDEOS, inferVideoContentType, extractClientFilename } from '../utils';

interface BatchDownloaderProps {
  onDownloadStarted: (filename: string, url: string, sizeBytes: number | null, contentType: string) => void;
}

export const BatchDownloader: React.FC<BatchDownloaderProps> = ({ onDownloadStarted }) => {
  const [inputUrls, setInputUrls] = useState<string>('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddUrls = () => {
    if (!inputUrls.trim()) return;
    const urls = inputUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    const newItems: BatchItem[] = urls.map((url) => {
      const pathname = new URL(url).pathname;
      const lastSeg = pathname.split('/').pop() || 'video.mp4';
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url,
        filename: lastSeg,
        status: 'idle',
        sizeBytes: null,
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    setInputUrls('');
  };

  const handleLoadSampleBatch = () => {
    const sampleBatch: BatchItem[] = SAMPLE_VIDEOS.slice(0, 3).map((sample) => ({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: sample.url,
      filename: `${sample.title.toLowerCase().replace(/\s+/g, '_')}.mp4`,
      status: 'idle',
      sizeBytes: null,
    }));
    setItems((prev) => [...prev, ...sampleBatch]);
  };

  const handleProbeAll = async () => {
    setIsProcessing(true);
    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'completed') continue;
      updated[i].status = 'probing';
      setItems([...updated]);

      try {
        let success = false;
        try {
          const res = await fetch('/api/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: updated[i].url }),
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.error) {
              updated[i].filename = data.filename || updated[i].filename;
              updated[i].sizeBytes = data.sizeBytes ?? null;
              updated[i].contentType = data.contentType;
              updated[i].status = 'ready';
              success = true;
            }
          }
        } catch {
          // Server not reachable
        }

        if (!success) {
          // Client-side fallback
          try {
            const parsed = new URL(updated[i].url);
            updated[i].filename = extractClientFilename(updated[i].url);
            updated[i].contentType = inferVideoContentType(parsed.pathname);
            updated[i].status = 'ready';
          } catch {
            updated[i].status = 'error';
            updated[i].error = 'Invalid URL';
          }
        }
      } catch (err: unknown) {
        updated[i].status = 'error';
        updated[i].error = err instanceof Error ? err.message : 'Network error';
      }
      setItems([...updated]);
    }
    setIsProcessing(false);
  };

  const handleDownloadSingle = async (item: BatchItem) => {
    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') || window.location.protocol === 'file:');

    if (!isStaticHost) {
      const downloadUrl = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(
        item.filename
      )}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      try {
        const response = await fetch(item.url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = item.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          throw new Error();
        }
      } catch {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = item.filename;
        link.target = '_blank';
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    onDownloadStarted(item.filename, item.url, item.sizeBytes, item.contentType || 'video/mp4');

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'completed' } : it))
    );
  };

  const handleDownloadAll = () => {
    items.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 800); // staggering download triggers
    });
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-zinc-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-base">
                Batch URL Queue
              </h3>
              <p className="text-xs text-zinc-500">
                Paste multiple video links (one URL per line) to probe and download simultaneously
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLoadSampleBatch}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Insert 3 Sample Videos
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            value={inputUrls}
            onChange={(e) => setInputUrls(e.target.value)}
            rows={3}
            placeholder={`https://example.com/video1.mp4\nhttps://example.com/video2.webm\nhttps://example.com/stream3.mp4`}
            className="w-full p-3 text-sm font-mono bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAddUrls}
              disabled={!inputUrls.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Queue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                Queue ({items.length} items)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleProbeAll}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>Probe Specs</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download All</span>
              </button>

              <button
                type="button"
                onClick={() => setItems([])}
                className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-colors"
                title="Clear queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {item.filename}
                    </span>
                    {item.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> Downloaded
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                        <AlertCircle className="w-3 h-3" /> Error
                      </span>
                    )}
                    {item.status === 'probing' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate font-mono mt-0.5">
                    {item.url}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                    <span>Size: {formatBytes(item.sizeBytes)}</span>
                    {item.contentType && (
                      <span className="uppercase text-[10px] bg-zinc-100 px-1.5 py-0.2 rounded text-zinc-600">
                        {item.contentType.split('/')[1] || item.contentType}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
