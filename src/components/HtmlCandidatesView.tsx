import React from 'react';
import { VideoProbeResult } from '../types';
import { FileVideo, Download, ArrowRight, AlertCircle, ExternalLink } from 'lucide-react';

interface HtmlCandidatesViewProps {
  result: VideoProbeResult;
  onSelectCandidate: (videoUrl: string) => void;
  onDownloadCandidate: (videoUrl: string, label: string) => void;
}

export const HtmlCandidatesView: React.FC<HtmlCandidatesViewProps> = ({
  result,
  onSelectCandidate,
  onDownloadCandidate,
}) => {
  const candidates = result.candidates || [];

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
      <div className="p-5 border-b border-zinc-100 bg-amber-50/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <FileVideo className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              Webpage Detected
            </span>
            <h3 className="font-semibold text-zinc-900 text-base mt-1">
              {result.title || 'Webpage with Media Content'}
            </h3>
            <p className="text-xs text-zinc-500 truncate max-w-xl">{result.url}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {candidates.length > 0 ? (
          <div>
            <p className="text-sm text-zinc-600 mb-3">
              We extracted <strong>{candidates.length}</strong> video stream
              {candidates.length === 1 ? '' : 's'} embedded in this page. Choose one below to preview or download:
            </p>

            <div className="space-y-2.5">
              {candidates.map((cand, idx) => {
                const downloadUrl = `/api/download?url=${encodeURIComponent(cand.url)}`;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-zinc-200 hover:border-blue-400 bg-zinc-50/50 hover:bg-blue-50/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 uppercase">
                          {cand.format || 'VIDEO'}
                        </span>
                        <span className="text-sm font-medium text-zinc-900 truncate">
                          {cand.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-1 font-mono">
                        {cand.url}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectCandidate(cand.url)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <span>Preview</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={downloadUrl}
                        download
                        onClick={() => onDownloadCandidate(cand.url, cand.label)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center space-y-3 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <AlertCircle className="w-8 h-8 mx-auto text-zinc-400" />
            <h4 className="text-sm font-semibold text-zinc-800">
              No direct video stream tags found in static HTML
            </h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              This webpage may be rendering its video player through client-side JavaScript, an iframe, or an encrypted player.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
              >
                <span>Visit original page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
