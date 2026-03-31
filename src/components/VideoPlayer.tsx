import { useState, useCallback, useEffect, useRef } from "react";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { useThumbnailPreview } from "../hooks/useThumbnailPreview";
import { PlayerControls } from "./PlayerControls";
import "./VideoPlayer.css";

interface VideoPlayerProps {
  src: string;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const { videoRef, containerRef, state, actions, speedOptions } =
    useVideoPlayer(src);
  const { previewUrl, previewTime, generatePreview, clearPreview } =
    useThumbnailPreview(videoRef, state.duration);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekPreviewTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [controlsTimerHidden, setControlsTimerHidden] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);

  const controlsVisible = !state.isPlaying || !controlsTimerHidden;

  const showControls = useCallback(() => {
    setControlsTimerHidden(false);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setControlsTimerHidden(true);
    }, 3000);
  }, []);

  // When video pauses, show controls and clear hide timer
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPause = () => {
      clearTimeout(hideTimerRef.current);
      setControlsTimerHidden(false);
    };

    video.addEventListener("pause", onPause);
    return () => video.removeEventListener("pause", onPause);
  }, [videoRef]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current);
      clearTimeout(seekPreviewTimerRef.current);
    };
  }, []);

  // Show a seek preview for a brief time after seeking via keys/buttons
  const showSeekPreview = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(time, state.duration));
      setSeekPreviewTime(clampedTime);
      generatePreview(clampedTime);
      clearTimeout(seekPreviewTimerRef.current);
      seekPreviewTimerRef.current = setTimeout(() => {
        setSeekPreviewTime(null);
      }, 1000);
    },
    [state.duration, generatePreview],
  );

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
          {
            const newTime = state.currentTime - 5;
            actions.seek(newTime);
            showSeekPreview(newTime);
          }
          showControls();
          break;
        case "arrowright":
          e.preventDefault();
          {
            const newTime = state.currentTime + 5;
            actions.seek(newTime);
            showSeekPreview(newTime);
          }
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
  }, [actions, state.currentTime, state.volume, showControls, showSeekPreview]);

  const isHls = /\.m3u8($|[?%&])/i.test(src);

  return (
    <div
      className={`vp-container ${controlsVisible ? "vp-controls-visible" : ""}`}
      ref={containerRef}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (state.isPlaying) setControlsTimerHidden(true);
      }}
    >
      <video
        ref={videoRef}
        className="vp-video"
        onClick={actions.togglePlay}
        playsInline
        preload="auto"
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
        previewUrl={previewUrl}
        previewTime={previewTime}
        onPreviewGenerate={generatePreview}
        onPreviewClear={clearPreview}
        seekPreviewTime={seekPreviewTime}
        actions={actions}
      />
    </div>
  );
}
