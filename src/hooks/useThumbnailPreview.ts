import { useRef, useState, useEffect, useCallback } from "react";

interface ThumbnailCache {
  [time: number]: string;
}

export function useThumbnailPreview(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  duration: number,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<ThumbnailCache>({});
  const prevSrcRef = useRef<string>("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<number>(0);

  // Create canvas once
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    canvasRef.current = canvas;

    return () => {
      canvasRef.current = null;
    };
  }, []);

  // Clear cache when video source changes
  useEffect(() => {
    const video = videoRef.current;
    const currentSrc = video?.src || "";
    if (currentSrc !== prevSrcRef.current) {
      cacheRef.current = {};
      prevSrcRef.current = currentSrc;
    }
  }, [videoRef, duration]);

  const generatePreview = useCallback(
    (time: number) => {
      if (duration <= 0) return;

      const clampedTime = Math.max(0, Math.min(time, duration));
      const roundedTime = Math.floor(clampedTime);
      setPreviewTime(clampedTime);

      // Check cache first
      if (cacheRef.current[roundedTime]) {
        setPreviewUrl(cacheRef.current[roundedTime]);
        return;
      }

      // Capture from the main video element's current painted frame
      // We can only capture what's currently rendered, so for hover previews
      // we show cached frames. For the current position we can always capture.
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // Capture the current frame (the video is already at some position)
      // For hover, we capture and cache the current frame at its current time
      const currentRounded = Math.floor(video.currentTime);
      if (!cacheRef.current[currentRounded]) {
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            cacheRef.current[currentRounded] = dataUrl;
          }
        } catch {
          // tainted canvas — ignore
        }
      }

      // Return cached if available for the requested time
      if (cacheRef.current[roundedTime]) {
        setPreviewUrl(cacheRef.current[roundedTime]);
      } else {
        // No cached frame for this time — show the nearest cached frame
        const cachedTimes = Object.keys(cacheRef.current).map(Number);
        if (cachedTimes.length > 0) {
          const nearest = cachedTimes.reduce((prev, curr) =>
            Math.abs(curr - roundedTime) < Math.abs(prev - roundedTime)
              ? curr
              : prev,
          );
          setPreviewUrl(cacheRef.current[nearest]);
        } else {
          setPreviewUrl(null);
        }
      }
    },
    [duration, videoRef],
  );

  const clearPreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  return {
    previewUrl,
    previewTime,
    generatePreview,
    clearPreview,
  };
}
