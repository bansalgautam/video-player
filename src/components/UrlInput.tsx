import { useState, useCallback } from "react";
import { parseCurl } from "../utils/curlParser";

interface UrlInputProps {
  onLoad: (url: string, headers?: Record<string, string>) => void;
}

export function UrlInput({ onLoad }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showCurl, setShowCurl] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>(
    {},
  );

  const headerCount = Object.keys(customHeaders).length;

  const handleCurlChange = useCallback((value: string) => {
    setCurlText(value);
    const trimmed = value.trim();
    if (trimmed.toLowerCase().startsWith("curl")) {
      const parsed = parseCurl(trimmed);
      if (parsed.url) {
        setUrl(parsed.url);
        setError("");
      }
      setCustomHeaders(parsed.headers);
    } else {
      setCustomHeaders({});
    }
  }, []);

  const clearHeaders = useCallback(() => {
    setCurlText("");
    setCustomHeaders({});
    setShowCurl(false);
  }, []);

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
    onLoad(trimmed, headerCount > 0 ? customHeaders : undefined);
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

          <button
            type="button"
            className="curl-toggle-btn"
            onClick={() => setShowCurl(!showCurl)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
            </svg>
            {showCurl ? "Hide curl import" : "Import from curl"}
            {headerCount > 0 && !showCurl && (
              <span className="header-badge">{headerCount} headers</span>
            )}
          </button>

          {showCurl && (
            <div className="curl-section">
              <textarea
                value={curlText}
                onChange={(e) => handleCurlChange(e.target.value)}
                placeholder={
                  "Paste a curl command to auto-extract URL and headers...\n\ncurl 'https://example.com/stream.m3u8' \\\n  -H 'Cookie: token=abc' \\\n  -H 'Referer: https://example.com'"
                }
                className="curl-textarea"
                rows={5}
              />
              {headerCount > 0 && (
                <div className="curl-parsed">
                  <div className="curl-parsed-header">
                    <span>{headerCount} headers extracted</span>
                    <button
                      type="button"
                      onClick={clearHeaders}
                      className="curl-clear-btn"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="curl-headers-list">
                    {Object.entries(customHeaders).map(([key, value]) => (
                      <div key={key} className="curl-header-item">
                        <span className="curl-header-key">{key}:</span>{" "}
                        <span className="curl-header-value">
                          {value.length > 80 ? value.slice(0, 80) + "…" : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {headerCount > 0 && (
                <p className="curl-proxy-notice">
                  Requests will be proxied through the dev server to attach
                  these headers.
                </p>
              )}
            </div>
          )}

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
