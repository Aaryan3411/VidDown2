import express, { Request, Response } from 'express';
import path from 'path';
import { Readable } from 'node:stream';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extractFilenameFromHeader(header?: string | null): string | null {
  if (!header) return null;
  // Match filename*="utf-8''..." or filename="..."
  const starMatch = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (starMatch && starMatch[1]) {
    try {
      return decodeURIComponent(starMatch[1].replace(/['"]/g, '').trim());
    } catch {
      return starMatch[1].replace(/['"]/g, '').trim();
    }
  }
  const regularMatch = header.match(/filename="?([^";]+)"?/i);
  if (regularMatch && regularMatch[1]) {
    return regularMatch[1].trim();
  }
  return null;
}

function inferVideoContentType(urlPath: string, headerType?: string): string {
  if (headerType && headerType.startsWith('video/')) return headerType;
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
      return headerType || 'video/mp4';
  }
}

function deriveFilenameFromUrl(rawUrl: string, contentType?: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment.includes('.')) {
      const decoded = decodeURIComponent(lastSegment);
      // Clean up unsafe filename characters
      return decoded.replace(/[/\\?%*:|"<>]/g, '_');
    }
  } catch {
    // fallback
  }

  // Fallback by content type
  let ext = 'mp4';
  if (contentType) {
    if (contentType.includes('webm')) ext = 'webm';
    else if (contentType.includes('ogg') || contentType.includes('ogv')) ext = 'ogv';
    else if (contentType.includes('quicktime') || contentType.includes('mov')) ext = 'mov';
    else if (contentType.includes('x-matroska') || contentType.includes('mkv')) ext = 'mkv';
    else if (contentType.includes('x-flv')) ext = 'flv';
    else if (contentType.includes('x-msvideo') || contentType.includes('avi')) ext = 'avi';
  }
  return `video_${Date.now()}.${ext}`;
}

// API: Probe Video URL
app.post('/api/probe', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'A valid URL is required.' });
    return;
  }

  try {
    const parsedUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported.' });
      return;
    }

    // Check if YouTube URL
    const ytMatch = parsedUrl.href.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    if (ytMatch) {
      const ytId = ytMatch[1];
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
        const oembedData = oembedRes.ok ? await oembedRes.json() : null;
        const title = oembedData?.title || `YouTube Video (${ytId})`;
        const filename = title.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim() + '.mp4';

        res.json({
          url: `https://www.youtube.com/watch?v=${ytId}`,
          isHtmlPage: false,
          isYouTube: true,
          youTubeId: ytId,
          title,
          author: oembedData?.author_name || 'YouTube Creator',
          thumbnailUrl: oembedData?.thumbnail_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=0`,
          filename,
          contentType: 'video/mp4',
          sizeBytes: null,
          acceptRanges: true,
          host: 'www.youtube.com',
        });
        return;
      } catch {
        // continue
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let headRes: globalThis.Response | null = null;
    try {
      headRes = await fetch(parsedUrl.href, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: '*/*',
        },
      });
    } catch {
      // HEAD may fail, proceed to GET with range
    }

    let contentType = headRes?.headers.get('content-type') || '';
    let contentLengthHeader = headRes?.headers.get('content-length');
    let contentDisposition = headRes?.headers.get('content-disposition');
    let acceptRanges = headRes?.headers.get('accept-ranges') === 'bytes';

    const isDirectVideo =
      contentType.toLowerCase().startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|m4v|flv|ogv|avi|ts)(\?.*)?$/i.test(parsedUrl.pathname);

    // If HEAD failed, returned non-200, or didn't provide enough details, try partial GET
    if (!headRes || !headRes.ok || (!isDirectVideo && contentType.includes('text/html'))) {
      try {
        const getController = new AbortController();
        const getTimeout = setTimeout(() => getController.abort(), 12000);

        const getRes = await fetch(parsedUrl.href, {
          method: 'GET',
          signal: getController.signal,
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: '*/*',
            Range: 'bytes=0-150000', // First ~150 KB for inspection
          },
        });

        clearTimeout(getTimeout);

        if (!contentType || contentType.includes('text/plain') || !headRes?.ok) {
          contentType = getRes.headers.get('content-type') || contentType;
        }
        if (!contentLengthHeader) {
          const contentRange = getRes.headers.get('content-range');
          if (contentRange) {
            const totalMatch = contentRange.match(/\/(\d+)/);
            if (totalMatch) contentLengthHeader = totalMatch[1];
          } else {
            contentLengthHeader = getRes.headers.get('content-length');
          }
        }
        if (!contentDisposition) {
          contentDisposition = getRes.headers.get('content-disposition');
        }
        if (getRes.headers.get('accept-ranges') === 'bytes') {
          acceptRanges = true;
        }

        // If it is an HTML webpage, inspect for embedded video tags / Open Graph
        if (contentType.includes('text/html')) {
          const text = await getRes.text();
          const candidates: Array<{ url: string; label: string; format?: string }> = [];

          // 1. Open Graph & Twitter meta tags
          const metaRegex = /<meta\s+[^>]*?(?:property|name)=["'](og:video|og:video:url|og:video:secure_url|twitter:player:stream)["'][^>]*?content=["']([^"']+)["'][^>]*>/gi;
          let match;
          while ((match = metaRegex.exec(text)) !== null) {
            const videoUrl = match[2];
            try {
              const fullUrl = new URL(videoUrl, parsedUrl.href).href;
              if (!candidates.some((c) => c.url === fullUrl)) {
                candidates.push({
                  url: fullUrl,
                  label: `Embedded Meta (${match[1]})`,
                  format: fullUrl.split('.').pop()?.split('?')[0] || 'video',
                });
              }
            } catch {
              // ignore invalid URL
            }
          }

          // 2. Video tag src
          const videoSrcRegex = /<video[^>]+src=["']([^"']+)["']/gi;
          while ((match = videoSrcRegex.exec(text)) !== null) {
            const videoUrl = match[1];
            try {
              const fullUrl = new URL(videoUrl, parsedUrl.href).href;
              if (!candidates.some((c) => c.url === fullUrl)) {
                candidates.push({
                  url: fullUrl,
                  label: 'Video Tag Source',
                  format: fullUrl.split('.').pop()?.split('?')[0] || 'mp4',
                });
              }
            } catch {
              // ignore
            }
          }

          // 3. Source tags inside video
          const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*?(?:type=["']video\/([^"']+)["'])?/gi;
          while ((match = sourceRegex.exec(text)) !== null) {
            const videoUrl = match[1];
            const typeHint = match[2];
            try {
              const fullUrl = new URL(videoUrl, parsedUrl.href).href;
              if (!candidates.some((c) => c.url === fullUrl)) {
                candidates.push({
                  url: fullUrl,
                  label: typeHint ? `${typeHint.toUpperCase()} Source` : 'Media Source',
                  format: typeHint || fullUrl.split('.').pop()?.split('?')[0] || 'mp4',
                });
              }
            } catch {
              // ignore
            }
          }

          clearTimeout(timeout);
          res.json({
            isHtmlPage: true,
            contentType,
            url: parsedUrl.href,
            candidates,
            title: text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '',
          });
          return;
        }
      } catch {
        // failed get probe
      }
    }

    clearTimeout(timeout);

    let parsedSize: number | null = null;
    if (contentLengthHeader) {
      const num = parseInt(contentLengthHeader, 10);
      if (!isNaN(num) && num > 0) parsedSize = num;
    }

    const filename =
      extractFilenameFromHeader(contentDisposition) ||
      deriveFilenameFromUrl(parsedUrl.href, contentType);

    const finalContentType = inferVideoContentType(parsedUrl.pathname, contentType);

    res.json({
      url: parsedUrl.href,
      isHtmlPage: false,
      contentType: finalContentType,
      sizeBytes: parsedSize,
      filename,
      acceptRanges,
      host: parsedUrl.hostname,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to inspect URL';
    res.status(500).json({ error: message });
  }
});

// API: Stream Proxy (supports Range requests for smooth frontend video preview)
app.get('/api/stream-proxy', async (req: Request, res: Response): Promise<void> => {
  const urlParam = req.query.url as string;
  if (!urlParam) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const parsedUrl = new URL(urlParam);
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const remoteRes = await fetch(parsedUrl.href, {
      headers,
      signal: abortController.signal,
    });

    res.status(remoteRes.status);
    const forwardHeaders = ['content-length', 'content-range', 'accept-ranges'];
    forwardHeaders.forEach((h) => {
      const val = remoteRes.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    const remoteContentType = remoteRes.headers.get('content-type');
    const finalStreamContentType = inferVideoContentType(parsedUrl.pathname, remoteContentType || undefined);
    res.setHeader('content-type', finalStreamContentType);

    // Enable cross-origin display for our own frontend
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!remoteRes.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(remoteRes.body as any);
    nodeStream.pipe(res);
  } catch (err: unknown) {
    if (!res.headersSent) {
      res.status(500).send('Failed to stream remote video');
    }
  }
});

// API: Download Proxy (sets Content-Disposition: attachment for forced file download)
app.get('/api/download', async (req: Request, res: Response): Promise<void> => {
  const urlParam = req.query.url as string;
  const customFilename = (req.query.filename as string)?.trim();

  if (!urlParam) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  try {
    const parsedUrl = new URL(urlParam);
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const remoteRes = await fetch(parsedUrl.href, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: '*/*',
      },
      signal: abortController.signal,
    });

    if (!remoteRes.ok && remoteRes.status >= 400) {
      res.status(remoteRes.status).json({
        error: `Remote server responded with HTTP ${remoteRes.status}: ${remoteRes.statusText}`,
      });
      return;
    }

    const rawContentType = remoteRes.headers.get('content-type') || 'application/octet-stream';
    const finalContentType = inferVideoContentType(parsedUrl.pathname, rawContentType);
    const contentLength = remoteRes.headers.get('content-length');
    const headerFilename = extractFilenameFromHeader(remoteRes.headers.get('content-disposition'));

    let finalFilename =
      customFilename ||
      headerFilename ||
      deriveFilenameFromUrl(parsedUrl.href, finalContentType);

    // Sanitize filename for safe download header
    finalFilename = finalFilename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'downloaded_video.mp4';

    res.setHeader('Content-Type', finalContentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    // Encode filename safely for Content-Disposition
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(finalFilename)}"; filename*=UTF-8''${encodeURIComponent(
        finalFilename
      )}`
    );

    if (!remoteRes.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(remoteRes.body as any);
    nodeStream.pipe(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error downloading stream';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
