import React from 'react';
import { HelpCircle, MousePointerClick, ShieldCheck, Cpu, Code2, Globe } from 'lucide-react';

export const HowToGuide: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-xs space-y-8">
      <div>
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <HelpCircle className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Help & Tips</span>
        </div>
        <h3 className="text-xl font-bold text-zinc-900">
          How to Find and Download Videos from Any URL
        </h3>
        <p className="text-sm text-zinc-500 mt-1">
          This downloader works with direct media streams, CDN endpoints, and webpage embedded sources.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h4 className="font-semibold text-zinc-900 text-base">Direct Video Links</h4>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Any URL pointing directly to a video container format (such as <code>.mp4</code>, <code>.webm</code>, <code>.mov</code>, <code>.mkv</code>, <code>.ogv</code>, or <code>.m4v</code>) will be inspected, previewed in the player, and downloaded with exact byte streaming.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h4 className="font-semibold text-zinc-900 text-base">Right-Click Video Trick</h4>
          <p className="text-xs text-zinc-600 leading-relaxed">
            On most websites using HTML5 video players, you can simply right-click directly on the playing video and select <span className="font-medium text-zinc-900">"Copy video address"</span> or <span className="font-medium text-zinc-900">"Copy audio/video link"</span>, then paste it here.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h4 className="font-semibold text-zinc-900 text-base">Browser DevTools Network Filter</h4>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-zinc-300 rounded text-[11px] font-mono">F12</kbd> or right-click and choose <strong>Inspect</strong>. Switch to the <strong>Network</strong> tab, click the <strong>Media</strong> filter, and play the video. The streaming video request will immediately appear in the list! Right click to copy its URL.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            4
          </div>
          <h4 className="font-semibold text-zinc-900 text-base">Direct Video URLs vs Stream Platforms</h4>
          <p className="text-xs text-zinc-600 leading-relaxed">
            VidDown is built as a <strong>100% standalone webpage</strong> with zero redirects to third-party ad sites. Paste any direct video link (MP4, WebM, MOV, or direct CDN URL) to download directly into your files. Proprietary streaming platforms (like YouTube) serve media in adaptive segmented DASH chunks rather than direct video files; VidDown provides in-app preview, thumbnail saving, and local terminal commands without sending you to external websites.
          </p>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950 space-y-1">
          <p className="font-semibold">Why Browsers Sometimes Open Links Instead of Downloading</p>
          <p className="text-blue-900/80 leading-relaxed">
            By default, modern web browsers (Chrome, Edge, Safari) ignore the <code>download</code> attribute when a link points to an external webpage or cross-origin server without <code>Content-Disposition: attachment</code> headers. Our app prevents this by converting media to direct in-memory blobs or providing verified 1-click download helpers.
          </p>
        </div>
      </div>
    </div>
  );
};
