import { useState, useRef, useEffect } from "react";
import type { SubtitleTrackInfo } from "../hooks/useVideoPlayer";

interface SubtitleControlProps {
  tracks: SubtitleTrackInfo[];
  activeTrack: number;
  onSelectTrack: (id: number) => void;
  onDisable: () => void;
}

export function SubtitleControl({
  tracks,
  activeTrack,
  onSelectTrack,
  onDisable,
}: SubtitleControlProps) {
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

  if (tracks.length === 0) return null;

  return (
    <div className="vp-control-group" ref={ref}>
      <button
        className={`vp-control-btn ${activeTrack >= 0 ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Subtitles"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z" />
        </svg>
      </button>
      {open && (
        <div className="vp-dropdown vp-dropdown-up">
          <button
            className={`vp-dropdown-item ${activeTrack < 0 ? "active" : ""}`}
            onClick={() => {
              onDisable();
              setOpen(false);
            }}
          >
            Off
          </button>
          {tracks.map((track) => (
            <button
              key={track.id}
              className={`vp-dropdown-item ${track.id === activeTrack ? "active" : ""}`}
              onClick={() => {
                onSelectTrack(track.id);
                setOpen(false);
              }}
            >
              {track.label}
              {track.language ? ` (${track.language})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
