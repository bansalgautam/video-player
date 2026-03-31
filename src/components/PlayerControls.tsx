import { useRef, useCallback, useState, useEffect } from "react";
import type { VideoPlayerState } from "../hooks/useVideoPlayer";
import { SpeedControl } from "./SpeedControl";
import { SubtitleControl } from "./SubtitleControl";
import { AudioTrackControl } from "./AudioTrackControl";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PlayerControlsProps {
  state: VideoPlayerState;
  speedOptions: number[];
  previewUrl: string | null;
  previewTime: number;
  onPreviewGenerate: (time: number) => void;
  onPreviewClear: () => void;
  seekPreviewTime: number | null;
  actions: {
    togglePlay: () => void;
    seek: (time: number) => void;
    setVolume: (vol: number) => void;
    toggleMute: () => void;
    setPlaybackRate: (rate: number) => void;
    toggleFullscreen: () => void;
    setAudioTrack: (id: number) => void;
    setSubtitleTrack: (id: number) => void;
    disableSubtitles: () => void;
  };
}

export function PlayerControls({
  state,
  speedOptions,
  previewUrl,
  previewTime,
  onPreviewGenerate,
  onPreviewClear,
  seekPreviewTime,
  actions,
}: PlayerControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const getProgressRatio = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      if (!bar || !state.duration) return null;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [state.duration],
  );

  // Drag: mousedown starts dragging
  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const ratio = getProgressRatio(e.clientX);
      if (ratio === null) return;

      isDraggingRef.current = true;
      wasPlayingRef.current = state.isPlaying;

      // Pause during drag for smooth scrubbing
      const video = document.querySelector<HTMLVideoElement>(".vp-video");
      if (video && !video.paused) video.pause();

      actions.seek(ratio * state.duration);
    },
    [getProgressRatio, state.duration, state.isPlaying, actions],
  );

  // Drag: mousemove while dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const ratio = getProgressRatio(e.clientX);
      if (ratio === null) return;
      actions.seek(ratio * state.duration);
      setHoverPercent(ratio * 100);
      onPreviewGenerate(ratio * state.duration);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const ratio = getProgressRatio(e.clientX);
      if (ratio !== null) {
        actions.seek(ratio * state.duration);
      }
      // Resume playback if it was playing before drag
      if (wasPlayingRef.current) {
        const video = document.querySelector<HTMLVideoElement>(".vp-video");
        video?.play();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [getProgressRatio, state.duration, actions, onPreviewGenerate]);

  // Touch drag support for mobile/TV
  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      const ratio = getProgressRatio(touch.clientX);
      if (ratio === null) return;

      isDraggingRef.current = true;
      wasPlayingRef.current = state.isPlaying;

      const video = document.querySelector<HTMLVideoElement>(".vp-video");
      if (video && !video.paused) video.pause();

      actions.seek(ratio * state.duration);
    },
    [getProgressRatio, state.duration, state.isPlaying, actions],
  );

  const handleProgressTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      const ratio = getProgressRatio(touch.clientX);
      if (ratio === null) return;
      actions.seek(ratio * state.duration);
    },
    [getProgressRatio, state.duration, actions],
  );

  const handleProgressTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (wasPlayingRef.current) {
      const video = document.querySelector<HTMLVideoElement>(".vp-video");
      video?.play();
    }
  }, []);

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      if (!bar || !state.duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      setHoverPercent(ratio * 100);
      onPreviewGenerate(ratio * state.duration);
    },
    [state.duration, onPreviewGenerate],
  );

  const handleProgressLeave = useCallback(() => {
    setHoverPercent(null);
    onPreviewClear();
  }, [onPreviewClear]);

  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = volumeRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      actions.setVolume(ratio);
    },
    [actions],
  );

  const volumeIcon =
    state.isMuted || state.volume === 0 ? (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    ) : state.volume < 0.5 ? (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    );

  const bufferedPercent =
    state.duration > 0 ? (state.buffered / state.duration) * 100 : 0;
  const progressPercent =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  // Determine which preview to show: seek preview (arrow keys/buttons) or hover preview
  const showSeekPreview = seekPreviewTime !== null;
  const activePreviewTime = showSeekPreview ? seekPreviewTime : previewTime;
  const activePreviewPercent =
    showSeekPreview && state.duration > 0
      ? (seekPreviewTime / state.duration) * 100
      : hoverPercent;

  return (
    <div className="vp-controls">
      {/* Progress bar */}
      <div
        className="vp-progress-container"
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        onMouseMove={handleProgressHover}
        onMouseLeave={handleProgressLeave}
        onTouchStart={handleProgressTouchStart}
        onTouchMove={handleProgressTouchMove}
        onTouchEnd={handleProgressTouchEnd}
      >
        {/* Preview tooltip */}
        {(hoverPercent !== null || showSeekPreview) &&
          activePreviewPercent !== null && (
            <div
              className="vp-preview-tooltip"
              style={{ left: `${activePreviewPercent}%` }}
            >
              {previewUrl && (
                <img
                  className="vp-preview-img"
                  src={previewUrl}
                  alt="Preview"
                />
              )}
              <span className="vp-preview-time">
                {formatTime(activePreviewTime)}
              </span>
            </div>
          )}
        <div className="vp-progress-bar">
          <div
            className="vp-progress-buffered"
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className="vp-progress-filled"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="vp-progress-thumb"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div className="vp-controls-row">
        <div className="vp-controls-left">
          {/* Rewind 10s */}
          <button
            className="vp-control-btn"
            onClick={() => actions.seek(state.currentTime - 10)}
            title="Rewind 10s"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              <text
                x="12"
                y="15.5"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="sans-serif"
              >
                10
              </text>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            className="vp-control-btn"
            onClick={actions.togglePlay}
            title={state.isPlaying ? "Pause" : "Play"}
          >
            {state.isPlaying ? (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward 10s */}
          <button
            className="vp-control-btn"
            onClick={() => actions.seek(state.currentTime + 10)}
            title="Forward 10s"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
              <text
                x="12"
                y="15.5"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="sans-serif"
              >
                10
              </text>
            </svg>
          </button>

          {/* Volume */}
          <button
            className="vp-control-btn"
            onClick={actions.toggleMute}
            title={state.isMuted ? "Unmute" : "Mute"}
          >
            {volumeIcon}
          </button>
          <div
            className="vp-volume-container"
            ref={volumeRef}
            onClick={handleVolumeClick}
          >
            <div className="vp-volume-bar">
              <div
                className="vp-volume-filled"
                style={{ width: `${state.isMuted ? 0 : state.volume * 100}%` }}
              />
            </div>
          </div>

          {/* Time */}
          <span className="vp-time">
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
        </div>

        <div className="vp-controls-right">
          {/* Speed */}
          <SpeedControl
            currentSpeed={state.playbackRate}
            options={speedOptions}
            onSpeedChange={actions.setPlaybackRate}
          />

          {/* Subtitles */}
          <SubtitleControl
            tracks={state.subtitleTracks}
            activeTrack={state.activeSubtitleTrack}
            onSelectTrack={actions.setSubtitleTrack}
            onDisable={actions.disableSubtitles}
          />

          {/* Audio tracks */}
          <AudioTrackControl
            tracks={state.audioTracks}
            activeTrack={state.activeAudioTrack}
            onSelectTrack={actions.setAudioTrack}
          />

          {/* Fullscreen */}
          <button
            className="vp-control-btn"
            onClick={actions.toggleFullscreen}
            title="Fullscreen"
          >
            {state.isFullscreen ? (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
