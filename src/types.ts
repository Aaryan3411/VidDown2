export interface VideoProbeResult {
  url: string;
  isHtmlPage: boolean;
  contentType?: string;
  sizeBytes?: number | null;
  filename?: string;
  acceptRanges?: boolean;
  host?: string;
  title?: string;
  author?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  isYouTube?: boolean;
  youTubeId?: string;
  candidates?: Array<{ url: string; label: string; format?: string }>;
  error?: string;
}

export interface DownloadHistoryItem {
  id: string;
  url: string;
  filename: string;
  sizeBytes: number | null;
  contentType: string;
  timestamp: number;
}

export interface BatchItem {
  id: string;
  url: string;
  filename: string;
  status: 'idle' | 'probing' | 'ready' | 'downloading' | 'completed' | 'error';
  sizeBytes: number | null;
  contentType?: string;
  error?: string;
}

export interface SampleVideo {
  title: string;
  resolution: string;
  format: string;
  sizeApprox: string;
  url: string;
}
