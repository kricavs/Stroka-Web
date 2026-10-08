"use client";

import { useEffect, useRef, useState } from "react";

// Lightweight YouTube player. Renders a poster + play button and only mounts
// the real iframe (youtube-nocookie) after the user asks for it, so no
// YouTube JS is downloaded while browsing. Props: { id, title }.
export default function YouTubeEmbed({ id, title, className = "" }) {
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  const frame = useRef(null);
  const fallback = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const switchToFallback = () => setPoster((p) => (p === fallback ? p : fallback));

  // The button disappears on click: hand focus to the player.
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-neutral-900 ${className}`}>
      {playing ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Reproducir video: ${title}`}
          className="group absolute inset-0 block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bone"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            // maxres thumbnails do not exist for every video (YouTube answers
            // with a 120px grey stub); hqdefault always does.
            onLoad={(e) => e.currentTarget.naturalWidth <= 120 && switchToFallback()}
            onError={switchToFallback}
            className="h-full w-full object-cover opacity-80 transition duration-700 ease-cine group-hover:scale-[1.02] group-hover:opacity-100"
          />
          <span className="absolute inset-0 bg-ink/30 transition-colors duration-500 group-hover:bg-ink/10" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-bone/70 text-bone transition-colors duration-300 group-hover:border-bone group-hover:bg-bone group-hover:text-ink md:h-20 md:w-20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="translate-x-px">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
