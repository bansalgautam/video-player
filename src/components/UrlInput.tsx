import { useState } from "react";

interface UrlInputProps {
  onLoad: (url: string) => void;
}

export function UrlInput({ onLoad }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setError("");
    onLoad(trimmed);
  };

  return (
    <div className="url-input-container">
      <div className="url-input-card">
        <div className="url-input-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM10 8l6 4-6 4V8z" />
          </svg>
        </div>
        <h1>Video Player</h1>
        <p className="url-input-subtitle">
          Enter a public video URL to start playing. Supports MP4, WebM, and HLS
          streams.
        </p>
        <form onSubmit={handleSubmit} className="url-input-form">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder="https://example.com/video.mp4"
            className="url-input-field"
            autoFocus
          />
          {error && <span className="url-input-error">{error}</span>}
          <button type="submit" className="url-input-btn">
            Load Video
          </button>
        </form>
        <div className="url-input-samples">
          <p>Try a sample:</p>
          <button
            type="button"
            className="url-sample-btn"
            onClick={() =>
              onLoad(
                "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4",
              )
            }
          >
            Big Buck Bunny (MP4)
          </button>
          <button
            type="button"
            className="url-sample-btn"
            onClick={() =>
              onLoad("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")
            }
          >
            HLS Test Stream
          </button>
        </div>
        <div className="url-input-notice">
          <p>
            <strong>Audio track switching:</strong> To switch audio languages on
            MP4 files in Chrome, enable{" "}
            <code>
              chrome://flags/#enable-experimental-web-platform-features
            </code>{" "}
            and restart the browser. Safari supports it natively.
          </p>
        </div>
      </div>
    </div>
  );
}
