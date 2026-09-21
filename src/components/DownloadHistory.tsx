import React from 'react';
import { History, Download, Trash2, Copy, Check, FileVideo } from 'lucide-react';
import { DownloadHistoryItem } from '../types';
import { formatBytes } from '../utils';

interface DownloadHistoryProps {
  history: DownloadHistoryItem[];
  onClearHistory: () => void;
  onRemoveItem: (id: string) => void;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  history,
  onClearHistory,
  onRemoveItem,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadAgain = (item: DownloadHistoryItem) => {
    const downloadUrl = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(
      item.filename
    )}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-xs">
        <History className="w-10 h-10 mx-auto text-zinc-300 mb-3" />
        <h3 className="font-semibold text-zinc-800 text-base">No downloads yet</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
          When you download videos through the URL downloader, they will appear here for fast re-downloading and tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-zinc-700" />
          <h3 className="font-semibold text-zinc-900 text-base">
            Recent Downloads ({history.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="divide-y divide-zinc-100">
        {history.map((item) => (
          <div
            key={item.id}
            className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <FileVideo className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-zinc-900 text-sm truncate">
                  {item.filename}
                </h4>
                <p className="text-xs text-zinc-400 font-mono truncate">{item.url}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                  <span>Size: {formatBytes(item.sizeBytes)}</span>
                  <span>•</span>
                  <span>{formatDate(item.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(item.id, item.url)}
                className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors"
                title="Copy URL"
              >
                {copiedId === item.id ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadAgain(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Again</span>
              </button>

              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md transition-colors"
                title="Delete from history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
