import React, { useState, useRef } from 'react';
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  FileVideo,
  HardDrive,
  Globe,
  Play,
  RotateCcw,
  Edit2,
  Sparkles,
  Terminal,
  Youtube,
  AlertCircle,
  Image as ImageIcon,
  CheckCircle2,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { VideoProbeResult } from '../types';
import { formatBytes, formatDuration, extractYouTubeId, getYouTubeCommands } from '../utils';

interface VideoPreviewCardProps {
  video: VideoProbeResult;
  onDownloadStarted: (filename: string, url: string, sizeBytes: number | null, contentType: string) => void;
  onLoadDirectSample?: (sampleUrl: string) => void;
}

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  video,
  onDownloadStarted,
  onLoadDirectSample,
}) => {
  const youTubeId = video.youTubeId || extractYouTubeId(video.url);
  const isYouTube = Boolean(video.isYouTube || youTubeId);

  const [customFilename, setCustomFilename] = useState<string>(
    video.filename || (isYouTube ? `${video.title || 'youtube_video'}.mp4` : 'video.mp4')
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [isDownloadingThumbnail, setIsDownloadingThumbnail] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [useDirectStream, setUseDirectStream] = useState<boolean>(
    typeof window !== 'undefined' && window.location.hostname.includes('github.io')
  );

  const streamProxyUrl = `/api/stream-proxy?url=${encodeURIComponent(video.url)}`;
  const effectiveStreamSrc = useDirectStream ? video.url : streamProxyUrl;
  const downloadApiUrl = `/api/download?url=${encodeURIComponent(video.url)}&filename=${encodeURIComponent(
    customFilename
  )}`;

  const ytCommands = youTubeId ? getYouTubeCommands(youTubeId) : null;

  const handleMetadataLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = e.currentTarget;
    if (target.duration && !isNaN(target.duration)) {
      setDuration(target.duration);
    }
    if (target.videoWidth && target.videoHeight) {
      setVideoDimensions({ width: target.videoWidth, height: target.videoHeight });
    }
    setVideoError(null);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(video.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2500);
    } catch {
      // fallback
    }
  };

  // In-page standalone thumbnail download for YouTube
  const handleDownloadThumbnail = async () => {
    if (!youTubeId) return;
    setIsDownloadingThumbnail(true);
    try {
      const thumbUrl = `https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`;
      const res = await fetch(thumbUrl, { mode: 'cors' });
      if (!res.ok) throw new Error('Thumbnail fetch failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${customFilename.replace(/\.[^/.]+$/, '')}_thumbnail.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: direct download link
      const link = document.createElement('a');
      link.href = `https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`;
      link.target = '_blank';
      link.download = 'thumbnail.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloadingThumbnail(false);
    }
  };

  // True standalone in-browser video download handler with live progress
  const handleTriggerDirectDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('Connecting to media stream...');
    setDownloadSuccess(false);
    setShowCorsHelp(false);

    onDownloadStarted(
      customFilename,
      video.url,
      video.sizeBytes ?? null,
      video.contentType ?? 'video/mp4'
    );

    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') || window.location.protocol === 'file:');

    // Scenario A: Full-stack backend available
    if (!isStaticHost) {
      setDownloadStatus('Downloading via stream proxy...');
      const link = document.createElement('a');
      link.href = downloadApiUrl;
      link.download = customFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadProgress(100);
      setDownloadStatus('Download initiated!');
      setDownloadSuccess(true);
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);
      return;
    }

    // Scenario B: Standalone static in-browser download (GitHub Pages)
    try {
      setDownloadStatus('Fetching video chunks into browser memory...');
      const startTime = Date.now();
      const response = await fetch(video.url, { mode: 'cors' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : video.sizeBytes || null;

      if (response.body && typeof ReadableStream !== 'undefined') {
        const reader = response.body.getReader();
        let receivedBytes = 0;
        const chunks: BlobPart[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedBytes += value.length;

          const elapsedSecs = (Date.now() - startTime) / 1000;
          if (elapsedSecs > 0) {
            const speedMBps = (receivedBytes / (1024 * 1024)) / elapsedSecs;
            setDownloadSpeed(`${speedMBps.toFixed(1)} MB/s`);
          }

          if (totalBytes && totalBytes > 0) {
            const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            setDownloadProgress(percent);
            setDownloadStatus(`Downloading: ${percent}% (${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)})`);
          } else {
            setDownloadStatus(`Streaming: ${formatBytes(receivedBytes)} downloaded`);
          }
        }

        setDownloadProgress(100);
        setDownloadStatus('Assembling video container and saving file...');

        const blob = new Blob(chunks, { type: video.contentType || 'video/mp4' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = customFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 20000);
        setDownloadSuccess(true);
        setDownloadStatus('Video saved to your downloads!');
        setIsDownloading(false);
        return;
      } else {
        // Simple blob fallback
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = customFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        setDownloadSuccess(true);
        setDownloadStatus('Video saved to your downloads!');
        setIsDownloading(false);
        return;
      }
    } catch {
      // Direct in-browser fetch was blocked by remote server CORS headers
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadStatus(null);
      setShowCorsHelp(true);
    }
  };

  const cleanContentType = (video.contentType || 'video/mp4')
    .split(';')[0]
    .replace('video/', '')
    .toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isYouTube ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isYouTube ? <Youtube className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900 text-base truncate">
                {video.title || customFilename}
              </h3>
              {!isYouTube && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(!isEditingName)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md transition-colors"
                  title="Rename file"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 truncate max-w-md">
              {video.author ? `${video.author} • ` : ''}
              {video.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-500" />
                <span>Copy URL</span>
              </>
            )}
          </button>

          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Open Source</span>
          </a>
        </div>
      </div>

      {/* Rename input if editing */}
      {isEditingName && !isYouTube && (
        <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center gap-3">
          <label htmlFor="custom-filename-input" className="text-xs font-semibold text-blue-900 shrink-0">
            File Name:
          </label>
          <input
            id="custom-filename-input"
            type="text"
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            placeholder="video.mp4"
            className="flex-1 px-3 py-1.5 text-sm bg-white border border-blue-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setIsEditingName(false)}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Main Body: Video Player & Specs */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Video Player Column */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center group">
            {isYouTube && youTubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youTubeId}?rel=0&modestbranding=1`}
                title={video.title || 'YouTube Video'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : videoError ? (
              <div className="p-6 text-center text-zinc-400 space-y-2">
                <FileVideo className="w-10 h-10 mx-auto text-zinc-500" />
                <p className="text-sm font-medium text-zinc-300">Live preview unavailable</p>
                <p className="text-xs text-zinc-500 max-w-xs">
                  The video format or server configuration restricts in-browser preview, but direct download is still available.
                </p>
                <button
                  onClick={() => {
                    setVideoError(null);
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium pt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Preview</span>
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={effectiveStreamSrc}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={handleMetadataLoaded}
                onError={() => {
                  if (!useDirectStream) {
                    setUseDirectStream(true);
                  } else {
                    setVideoError('Error loading video stream');
                  }
                }}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span className="flex items-center gap-1.5">
              {isYouTube ? (
                <>
                  <Youtube className="w-3.5 h-3.5 text-red-600" />
                  <span className="font-medium text-zinc-700">Interactive YouTube In-App Player</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-blue-600" />
                  <span>{useDirectStream ? 'Direct source stream' : 'Preview streamed via proxy'}</span>
                </>
              )}
            </span>
            {duration && <span>Duration: {formatDuration(duration)}</span>}
          </div>
        </div>

        {/* Specifications & Standalone Actions Column */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-6">
          {/* Metadata Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {isYouTube ? 'YouTube Properties' : 'Video Properties'}
              </h4>
              {isYouTube && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200/80 rounded-md">
                  Web Stream (DASH/HLS)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{isYouTube ? 'Available Qualities' : 'Estimated Size'}</span>
                </div>
                <div className="text-sm font-bold text-zinc-900">
                  {isYouTube ? '1080p, 720p, 480p' : formatBytes(video.sizeBytes)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <FileVideo className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Container / Type</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 uppercase">
                  {isYouTube ? 'DASH Web Stream' : cleanContentType}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{isYouTube ? 'Channel / Author' : 'Resolution'}</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 truncate" title={video.author}>
                  {isYouTube
                    ? video.author || 'YouTube'
                    : videoDimensions
                    ? `${videoDimensions.width} × ${videoDimensions.height}`
                    : 'Auto-detecting...'}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Server Host</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 truncate" title={video.host}>
                  {video.host || (isYouTube ? 'youtube.com' : 'Remote CDN')}
                </div>
              </div>
            </div>

            {video.acceptRanges && !isYouTube && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200/60">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Server supports byte-range streaming and resume</span>
              </div>
            )}
          </div>

          {/* Action Section */}
          {isYouTube ? (
            /* YouTube Standalone Toolset (Zero Redirects to 3rd-party websites) */
            <div className="space-y-4 pt-4 border-t border-zinc-100">
              {/* Standalone Clarification Box */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-900 font-semibold">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>100% Standalone Webpage Guarantee</span>
                </div>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Unlike aggregator websites, VidDown <strong>never redirects you to third-party ad services or spam converters</strong>.
                </p>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  YouTube encrypts its media into separate adaptive audio/video chunks (DASH/HLS) that cannot be saved directly as a static file by browser scripts without external re-encoding. VidDown directly downloads <strong>all direct video URLs (.mp4, .webm, .mov)</strong> directly to your computer.
                </p>
              </div>

              {/* Standalone Action 1: Download Cover Thumbnail */}
              <button
                type="button"
                onClick={handleDownloadThumbnail}
                disabled={isDownloadingThumbnail}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-zinc-300" />
                <span>{isDownloadingThumbnail ? 'Saving Thumbnail...' : 'Download HD Cover Thumbnail (JPG)'}</span>
              </button>

              {/* Standalone Action 2: Direct Command Line for Original Video */}
              {ytCommands && (
                <div className="p-3.5 bg-zinc-900 rounded-xl text-zinc-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download Video Locally (CLI)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCommand(ytCommands.ytDlpVideoCmd)}
                      className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
                    >
                      {copiedCmd ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Download full 1080p audio/video directly on your computer with zero web converters:
                  </p>
                  <pre className="font-mono text-[10px] text-zinc-300 overflow-x-auto select-all bg-black/40 p-2 rounded-sm">
                    {ytCommands.ytDlpVideoCmd}
                  </pre>
                </div>
              )}

              {/* Standalone Action 3: Switch to direct MP4 sample */}
              {onLoadDirectSample && (
                <button
                  type="button"
                  onClick={() => onLoadDirectSample('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-xl border border-blue-200 transition-colors"
                >
                  <span>Test Standalone Downloader with Direct MP4</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            /* Direct Media Stream Download (Pure Standalone In-Page Engine) */
            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <button
                id="btn-trigger-download"
                type="button"
                onClick={handleTriggerDirectDownload}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-semibold rounded-xl shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all"
              >
                <Download className="w-5 h-5" />
                <span>{isDownloading ? 'Downloading Video...' : 'Download Video Now'}</span>
              </button>

              {/* In-Page Download Progress Bar */}
              {isDownloading && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-blue-900 font-medium">
                    <span>{downloadStatus || 'Downloading video...'}</span>
                    {downloadSpeed && <span className="font-mono text-[11px]">{downloadSpeed}</span>}
                  </div>
                  <div className="w-full h-2 bg-blue-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{ width: `${downloadProgress ?? 20}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Banner */}
              {downloadSuccess && !isDownloading && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2.5 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Video saved directly to your device!</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                <span>Direct media container file</span>
                <span className="font-mono text-[11px] text-zinc-400">
                  .{customFilename.split('.').pop()}
                </span>
              </div>

              {/* Static CORS helper if direct automated save was blocked on GitHub Pages */}
              {showCorsHelp && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-3 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">
                        Browser Security Restriction (CORS)
                      </p>
                      <p className="text-amber-800 mt-0.5 leading-relaxed text-[11px]">
                        This remote media host does not allow third-party scripts to fetch raw video bytes into browser memory. You can save it directly using standard browser controls:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/80 space-y-1">
                      <span className="font-semibold text-zinc-900">Method 1: Right-Click Video Player</span>
                      <p className="text-zinc-600 text-[11px]">
                        Right-click the video player on the left and choose <strong className="text-zinc-900">"Save Video As..."</strong> to directly save the original file to your disk.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-zinc-900">Method 2: Open Media Directly</span>
                        <p className="text-zinc-600 text-[11px]">Opens the raw stream in browser player where Ctrl+S saves it.</p>
                      </div>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-medium shrink-0"
                      >
                        Open Stream
                      </a>
                    </div>

                    <div className="p-2.5 bg-zinc-900 text-zinc-100 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="font-mono text-[11px]">Method 3: Terminal Command</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(`curl -L -o "${customFilename}" "${video.url}"`)}
                          className="text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          {copiedCmd ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="font-mono text-[10px] text-zinc-300 overflow-x-auto select-all">
                        curl -L -o "{customFilename}" "{video.url}"
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
