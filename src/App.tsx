import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { VideoPlayer } from "./components/VideoPlayer";
import { UrlInput } from "./components/UrlInput";
import { ShareControl } from "./components/ShareControl";
import "./App.css";

async function createProxySession(
  headers: Record<string, string>,
): Promise<string | null> {
  try {
    const res = await fetch("/api/proxy/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headers }),
    });
    const data = await res.json();
    return data.sessionId;
  } catch (err) {
    console.error("Failed to create proxy session:", err);
    return null;
  }
}

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const videoUrl = searchParams.get("url");
  const headersParam = searchParams.get("h");
  const [proxySessionId, setProxySessionId] = useState<string | null>(null);
  const autoSessionCreated = useRef(false);

  // Auto-create proxy session when opening a shared link with headers
  useEffect(() => {
    if (!videoUrl || !headersParam || autoSessionCreated.current) return;
    autoSessionCreated.current = true;
    try {
      const headers = JSON.parse(atob(headersParam));
      if (
        headers &&
        typeof headers === "object" &&
        Object.keys(headers).length > 0
      ) {
        createProxySession(headers).then(setProxySessionId);
      }
    } catch {
      console.error("Failed to parse headers from URL");
    }
  }, [videoUrl, headersParam]);

  const handleLoad = async (url: string, headers?: Record<string, string>) => {
    const params: Record<string, string> = { url };
    if (headers && Object.keys(headers).length > 0) {
      const sessionId = await createProxySession(headers);
      setProxySessionId(sessionId);
      params.h = btoa(JSON.stringify(headers));
    } else {
      setProxySessionId(null);
    }
    setSearchParams(params);
  };

  const handleClear = () => {
    setSearchParams({});
    setProxySessionId(null);
    autoSessionCreated.current = false;
  };

  // When a proxy session exists, route through the local proxy
  const effectiveSrc =
    videoUrl && proxySessionId
      ? `/api/proxy/${proxySessionId}?url=${encodeURIComponent(videoUrl)}`
      : videoUrl;

  return (
    <div className="app">
      {effectiveSrc ? (
        <div className="player-wrapper">
          <VideoPlayer src={effectiveSrc} />
          <div className="player-actions">
            <button className="change-video-btn" onClick={handleClear}>
              Change Video
            </button>
            <ShareControl videoUrl={videoUrl!} />
          </div>
        </div>
      ) : (
        <UrlInput onLoad={handleLoad} />
      )}
    </div>
  );
}

export default App;
