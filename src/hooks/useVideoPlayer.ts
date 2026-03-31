import { useRef, useState, useEffect, useCallback } from "react";
import Hls from "hls.js";

export interface AudioTrackInfo {
  id: number;
  name: string;
  lang: string;
}

export interface SubtitleTrackInfo {
  id: number;
  label: string;
  language: string;
  mode: TextTrackMode;
}

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  buffered: number;
  isLoading: boolean;
  error: string | null;
  audioTracks: AudioTrackInfo[];
  activeAudioTrack: number;
  subtitleTracks: SubtitleTrackInfo[];
  activeSubtitleTrack: number;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function useVideoPlayer(src: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isFullscreen: false,
    buffered: 0,
    isLoading: true,
    error: null,
    audioTracks: [],
    activeAudioTrack: -1,
    subtitleTracks: [],
    activeSubtitleTrack: -1,
  });

  const isHls = /\.m3u8($|[?%&])/i.test(src);

  // Cleanup HLS instance
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  function updateHlsAudioTracks() {
    const hls = hlsRef.current;
    if (!hls) return;
    const tracks: AudioTrackInfo[] = hls.audioTracks.map((t, i) => ({
      id: i,
      name: t.name || `Track ${i + 1}`,
      lang: t.lang || "",
    }));
    setState((s) => ({
      ...s,
      audioTracks: tracks,
      activeAudioTrack: hls.audioTrack,
    }));
  }

  function updateHlsSubtitleTracks() {
    const hls = hlsRef.current;
    if (!hls) return;
    const tracks: SubtitleTrackInfo[] = hls.subtitleTracks.map((t, i) => ({
      id: i,
      label: t.name || `Subtitle ${i + 1}`,
      language: t.lang || "",
      mode: "disabled" as TextTrackMode,
    }));
    setState((s) => ({
      ...s,
      subtitleTracks: tracks,
      activeSubtitleTrack: hls.subtitleTrack,
    }));
  }

  // Initialize video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        startLevel: -1,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setState((s) => ({ ...s, isLoading: false }));
        updateHlsAudioTracks();
        updateHlsSubtitleTracks();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateHlsAudioTracks);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateHlsSubtitleTracks);
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
        if (hlsRef.current) {
          setState((s) => ({
            ...s,
            activeAudioTrack: hlsRef.current!.audioTrack,
          }));
        }
      });
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, () => {
        if (hlsRef.current) {
          setState((s) => ({
            ...s,
            activeSubtitleTrack: hlsRef.current!.subtitleTrack,
          }));
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setState((s) => ({
                ...s,
                error: "Fatal playback error. Please try another URL.",
                isLoading: false,
              }));
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      video.src = src;
    } else {
      // Direct file (MP4, WebM, etc.)
      video.src = src;
    }

    return () => {
      destroyHls();
    };
  }, [src, isHls, destroyHls]);

  // Sync native text tracks (for non-HLS sources like MP4 with <track> elements)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHls) return;

    const syncTextTracks = () => {
      const tracks: SubtitleTrackInfo[] = [];
      for (let i = 0; i < video.textTracks.length; i++) {
        const t = video.textTracks[i];
        if (t.kind === "subtitles" || t.kind === "captions") {
          tracks.push({
            id: i,
            label: t.label || `Subtitle ${i + 1}`,
            language: t.language || "",
            mode: t.mode,
          });
        }
      }
      setState((s) => ({ ...s, subtitleTracks: tracks }));
    };

    video.textTracks.addEventListener("change", syncTextTracks);
    // Also run once after metadata loads
    video.addEventListener("loadedmetadata", syncTextTracks);

    return () => {
      video.textTracks.removeEventListener("change", syncTextTracks);
      video.removeEventListener("loadedmetadata", syncTextTracks);
    };
  }, [src, isHls]);

  // Sync native audio tracks (for non-HLS sources like MP4 with multiple audio tracks)
  // Uses the experimental HTMLMediaElement.audioTracks API (Safari, Chrome with flag)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHls) return;

    const videoEl = video as HTMLVideoElement & {
      audioTracks?: {
        length: number;
        [index: number]: {
          id: string;
          kind: string;
          label: string;
          language: string;
          enabled: boolean;
        };
        addEventListener: (event: string, handler: () => void) => void;
        removeEventListener: (event: string, handler: () => void) => void;
      };
    };

    const syncAudioTracks = () => {
      if (!videoEl.audioTracks || videoEl.audioTracks.length === 0) return;
      const tracks: AudioTrackInfo[] = [];
      let activeTrack = -1;
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        const t = videoEl.audioTracks[i];
        tracks.push({
          id: i,
          name: t.label || t.language || `Track ${i + 1}`,
          lang: t.language || "",
        });
        if (t.enabled) activeTrack = i;
      }
      setState((s) => ({
        ...s,
        audioTracks: tracks,
        activeAudioTrack: activeTrack,
      }));
    };

    video.addEventListener("loadedmetadata", syncAudioTracks);
    if (videoEl.audioTracks) {
      videoEl.audioTracks.addEventListener("change", syncAudioTracks);
      videoEl.audioTracks.addEventListener("addtrack", syncAudioTracks);
      videoEl.audioTracks.addEventListener("removetrack", syncAudioTracks);
    }

    return () => {
      video.removeEventListener("loadedmetadata", syncAudioTracks);
      if (videoEl.audioTracks) {
        videoEl.audioTracks.removeEventListener("change", syncAudioTracks);
        videoEl.audioTracks.removeEventListener("addtrack", syncAudioTracks);
        videoEl.audioTracks.removeEventListener("removetrack", syncAudioTracks);
      }
    };
  }, [src, isHls]);

  // Video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));
    const onLoadStart = () =>
      setState((s) => ({ ...s, isLoading: true, error: null }));
    const onTimeUpdate = () =>
      setState((s) => ({ ...s, currentTime: video.currentTime }));
    const onDurationChange = () =>
      setState((s) => ({ ...s, duration: video.duration || 0 }));
    const onVolumeChange = () =>
      setState((s) => ({
        ...s,
        volume: video.volume,
        isMuted: video.muted,
      }));
    const onWaiting = () => setState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => setState((s) => ({ ...s, isLoading: false }));
    const onError = () =>
      setState((s) => ({
        ...s,
        error: "Failed to load video. Please check the URL.",
        isLoading: false,
      }));
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setState((s) => ({
          ...s,
          buffered: video.buffered.end(video.buffered.length - 1),
        }));
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadstart", onLoadStart);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("progress", onProgress);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadstart", onLoadStart);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("progress", onProgress);
    };
  }, [src]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setState((s) => ({
        ...s,
        isFullscreen: !!document.fullscreenElement,
      }));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Wake Lock: prevent device from sleeping while video is playing
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
        });
      } catch {
        // Wake lock request failed (e.g. low battery, background tab)
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    };

    if (state.isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock when tab becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && state.isPlaying) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state.isPlaying]);

  // Actions
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, vol));
    if (vol > 0) video.muted = false;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setState((s) => ({ ...s, playbackRate: rate }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const setAudioTrack = useCallback((trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
    } else {
      // Native audioTracks API
      const video = videoRef.current as
        | (HTMLVideoElement & {
            audioTracks?: {
              length: number;
              [index: number]: { enabled: boolean };
            };
          })
        | null;
      if (video?.audioTracks) {
        for (let i = 0; i < video.audioTracks.length; i++) {
          video.audioTracks[i].enabled = i === trackId;
        }
        setState((s) => ({ ...s, activeAudioTrack: trackId }));
      }
    }
  }, []);

  const setSubtitleTrack = useCallback((trackId: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = trackId;
      setState((s) => ({ ...s, activeSubtitleTrack: trackId }));
    } else {
      // Native text tracks
      const video = videoRef.current;
      if (!video) return;
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === trackId ? "showing" : "disabled";
      }
      setState((s) => ({ ...s, activeSubtitleTrack: trackId }));
    }
  }, []);

  const disableSubtitles = useCallback(() => {
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = -1;
      setState((s) => ({ ...s, activeSubtitleTrack: -1 }));
    } else {
      const video = videoRef.current;
      if (!video) return;
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = "disabled";
      }
      setState((s) => ({ ...s, activeSubtitleTrack: -1 }));
    }
  }, []);

  return {
    videoRef,
    containerRef,
    state,
    actions: {
      togglePlay,
      seek,
      setVolume,
      toggleMute,
      setPlaybackRate,
      toggleFullscreen,
      setAudioTrack,
      setSubtitleTrack,
      disableSubtitles,
    },
    speedOptions: SPEED_OPTIONS,
  };
}
