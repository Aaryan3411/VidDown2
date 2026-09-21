import { SampleVideo } from './types';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return 'Unknown size';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);

  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function inferVideoContentType(urlPath: string): string {
  const ext = urlPath.split('.').pop()?.split('?')[0]?.toLowerCase();
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'ogv':
    case 'ogg':
      return 'video/ogg';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'flv':
      return 'video/x-flv';
    case 'ts':
      return 'video/mp2t';
    default:
      return 'video/mp4';
  }
}

export function extractClientFilename(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (last && last.includes('.')) {
      return decodeURIComponent(last).replace(/[/\\?%*:|"<>]/g, '_');
    }
  } catch {
    // fallback
  }
  return `video_${Date.now()}.mp4`;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      if (id && id.length >= 8) return id;
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/watch')) {
        const v = parsed.searchParams.get('v');
        if (v) return v;
      }
      if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/v/')) {
        const id = parsed.pathname.split('/')[2]?.split('?')[0];
        if (id && id.length >= 8) return id;
      }
    }
  } catch {
    // fallback regex
  }
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

export async function fetchYouTubeMetadata(
  videoId: string
): Promise<{ title: string; author: string; thumbnailUrl: string; embedUrl: string } | null> {
  try {
    const target = `https://www.youtube.com/watch?v=${videoId}`;
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || `YouTube_Video_${videoId}`,
        author: data.author_name || 'YouTube Creator',
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
      };
    }
  } catch {
    // network or blocked
  }
  return {
    title: `YouTube_Video_${videoId}`,
    author: 'YouTube',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
  };
}

export function sanitizeFilename(name: string, ext = 'mp4'): string {
  const sanitized = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  if (sanitized.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return sanitized;
  }
  return `${sanitized}.${ext}`;
}

export function getYouTubeCommands(videoId: string) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    ytDlpVideoCmd: `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${ytUrl}"`,
    ytDlpAudioCmd: `yt-dlp -x --audio-format mp3 "${ytUrl}"`,
  };
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    title: 'Blooming Flower (MP4)',
    resolution: '640 × 360',
    format: 'MP4',
    sizeApprox: '~1.1 MB',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
  {
    title: 'Sintel Short Animation (MP4)',
    resolution: '854 × 480',
    format: 'MP4',
    sizeApprox: '~22.3 MB',
    url: 'https://raw.githubusercontent.com/mdn/learning-area/main/javascript/apis/video-audio/finished/video/sintel-short.mp4',
  },
  {
    title: 'Big Buck Bunny (WebM)',
    resolution: '854 × 480',
    format: 'WebM',
    sizeApprox: '~96.6 MB',
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm',
  },
  {
    title: 'Blooming Flower (WebM)',
    resolution: '640 × 360',
    format: 'WebM',
    sizeApprox: '~554 KB',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
  },
];
