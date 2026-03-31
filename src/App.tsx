import { useState } from "react";
import { useSearchParams } from "react-router";
import { VideoPlayer } from "./components/VideoPlayer";
import { UrlInput } from "./components/UrlInput";
import { ShareControl } from "./components/ShareControl";
import "./App.css";

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const videoUrl = searchParams.get("url");
  const headersParam = searchParams.get("h");
  const [, setForceUpdate] = useState(0);

  const handleLoad = async (url: string, headers?: Record<string, string>) => {
    const params: Record<string, string> = { url };
    if (headers && Object.keys(headers).length > 0) {
      params.h = btoa(JSON.stringify(headers));
    }
    setSearchParams(params);
    setForceUpdate((n) => n + 1);
  };

  const handleClear = () => {
    setSearchParams({});
  };

  // When headers are present, route through the proxy
  const effectiveSrc =
    videoUrl && headersParam
      ? `/api/proxy?url=${encodeURIComponent(videoUrl)}&h=${encodeURIComponent(headersParam)}`
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
