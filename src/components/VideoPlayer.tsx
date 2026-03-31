import { useState, useCallback, useEffect, useRef } from "react";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { PlayerControls } from "./PlayerControls";
import "./VideoPlayer.css";

interface VideoPlayerProps {
  src: string;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const { videoRef, containerRef, state, actions, speedOptions } =
    useVideoPlayer(src);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (state.isPlaying) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [state.isPlaying]);

  // Show controls when paused
  useEffect(() => {
    if (!state.isPlaying) {
      setControlsVisible(true);
      clearTimeout(hideTimerRef.current);
    }
  }, [state.isPlaying]);

  // Cleanup timer
  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          actions.togglePlay();
          showControls();
          break;
        case "arrowleft":
          e.preventDefault();
          actions.seek(state.currentTime - 5);
          showControls();
          break;
        case "arrowright":
          e.preventDefault();
          actions.seek(state.currentTime + 5);
          showControls();
          break;
        case "arrowup":
          e.preventDefault();
          actions.setVolume(Math.min(1, state.volume + 0.1));
          showControls();
          break;
        case "arrowdown":
          e.preventDefault();
          actions.setVolume(Math.max(0, state.volume - 0.1));
          showControls();
          break;
        case "m":
          actions.toggleMute();
          showControls();
          break;
        case "f":
          actions.toggleFullscreen();
          showControls();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [actions, state.currentTime, state.volume, showControls]);

  const isHls = /\.m3u8($|\?)/.test(src);

  return (
    <div
      className={`vp-container ${controlsVisible ? "vp-controls-visible" : ""}`}
      ref={containerRef}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (state.isPlaying) setControlsVisible(false);
      }}
    >
      <video
        ref={videoRef}
        className="vp-video"
        onClick={actions.togglePlay}
        playsInline
        {...(isHls ? { crossOrigin: "anonymous" as const } : {})}
      />

      {/* Loading spinner */}
      {state.isLoading && (
        <div className="vp-overlay">
          <div className="vp-spinner" />
        </div>
      )}

      {/* Error message */}
      {state.error && (
        <div className="vp-overlay">
          <div className="vp-error">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <p>{state.error}</p>
          </div>
        </div>
      )}

      {/* Big play button when paused and not loading */}
      {!state.isPlaying &&
        !state.isLoading &&
        !state.error &&
        state.duration > 0 && (
          <div
            className="vp-overlay vp-overlay-play"
            onClick={actions.togglePlay}
          >
            <svg
              className="vp-big-play"
              viewBox="0 0 24 24"
              width="72"
              height="72"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

      {/* Controls */}
      <PlayerControls
        state={state}
        speedOptions={speedOptions}
        actions={actions}
      />
    </div>
  );
}
