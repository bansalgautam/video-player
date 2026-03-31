import { useState, useRef, useEffect } from "react";
import type { AudioTrackInfo } from "../hooks/useVideoPlayer";

interface AudioTrackControlProps {
  tracks: AudioTrackInfo[];
  activeTrack: number;
  onSelectTrack: (id: number) => void;
}

export function AudioTrackControl({
  tracks,
  activeTrack,
  onSelectTrack,
}: AudioTrackControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (tracks.length <= 1) return null;

  return (
    <div className="vp-control-group" ref={ref}>
      <button
        className="vp-control-btn"
        onClick={() => setOpen(!open)}
        title="Audio language"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
        </svg>
      </button>
      {open && (
        <div className="vp-dropdown vp-dropdown-up">
          {tracks.map((track) => (
            <button
              key={track.id}
              className={`vp-dropdown-item ${track.id === activeTrack ? "active" : ""}`}
              onClick={() => {
                onSelectTrack(track.id);
                setOpen(false);
              }}
            >
              {track.name}
              {track.lang ? ` (${track.lang})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
